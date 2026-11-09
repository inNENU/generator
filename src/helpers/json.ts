import type { Dirent } from "node:fs";
import { realpathSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import nodePath from "node:path";

import { isPathInside } from "./fileTraversal.js";
import { createPromiseQueue } from "./promiseQueue.js";

/** JSON 文件扩展名 */
const JSON_EXTENSION = ".json";

/** 同时进行的目录读取或文件检查数量，避免大目录树耗尽文件描述符 */
const MAX_CONCURRENCY = 16;

interface DirectoryScan {
  /** 目录路径 */
  directory: string;
  /** 目录内容 */
  entries: Dirent[];
}

/**
 * 获取错误原因的可读信息
 *
 * @param error 错误原因
 * @returns 可读的错误信息
 */
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 判断文件名是否为 JSON 文件
 *
 * 与旧实现保持一致，扩展名区分大小写。
 *
 * @param fileName 文件名
 * @returns 是否为 JSON 文件
 */
const isJSONFile = (fileName: string): boolean => nodePath.extname(fileName) === JSON_EXTENSION;

interface SymbolicLinkResolution {
  /** 需要检查的 JSON 文件 */
  file?: string;
  /** 无法跟随时的告警 */
  warning?: string;
  /** 无效链接对应的错误 */
  failure?: Error;
}

/**
 * 解析目录项中的符号链接
 *
 * @param entryPath 符号链接路径
 * @param name 文件名
 * @param rootReal 检查目录的 realpath
 * @returns 解析结果
 */
const resolveJSONSymbolicLink = (
  entryPath: string,
  name: string,
  rootReal: string,
): SymbolicLinkResolution => {
  let targetStat;

  try {
    targetStat = statSync(entryPath);
  } catch (err) {
    // 失效的 .json 链接仍需报错，避免被静默漏检
    return isJSONFile(name)
      ? {
          failure: new Error(`读取文件 ${entryPath} 失败: ${getErrorMessage(err)}`, { cause: err }),
        }
      : {};
  }

  if (targetStat.isDirectory()) return { warning: `跳过符号链接目录（不跟随）: ${entryPath}` };

  if (!targetStat.isFile() || !isJSONFile(name)) return {};

  let targetReal: string;

  try {
    targetReal = realpathSync(entryPath);
  } catch (err) {
    return {
      failure: new Error(`读取文件 ${entryPath} 失败: ${getErrorMessage(err)}`, { cause: err }),
    };
  }

  return isPathInside(rootReal, targetReal)
    ? { file: entryPath }
    : { failure: new Error(`符号链接 ${entryPath} 指向检查目录之外: ${targetReal}`) };
};

interface JSONCheckContext {
  /** 待检查的 JSON 文件路径 */
  files: string[];
  /** 记录并打印错误 */
  reportFailure: (key: string, error: Error) => void;
}

/**
 * 收集符号链接目录项
 *
 * @param context 检查上下文
 * @param entryPath 符号链接路径
 * @param name 文件名
 * @param rootReal 检查目录的 realpath
 */
const collectJSONSymbolicLink = (
  context: JSONCheckContext,
  entryPath: string,
  name: string,
  rootReal: string,
): void => {
  const resolution = resolveJSONSymbolicLink(entryPath, name, rootReal);

  if (resolution.failure) context.reportFailure(`file:${entryPath}`, resolution.failure);
  else if (resolution.warning) console.warn(resolution.warning);
  else if (resolution.file) context.files.push(resolution.file);
};

/**
 * 检查目录下所有 JSON 文件
 *
 * 目录遍历与文件解析均使用有界并发，避免大型目录树触发 EMFILE。 读取或解析失败的文件只报告一次，并收集所有错误后统一抛出。
 *
 * 符号链接策略与文件遍历工具保持一致：不递归符号链接目录（打印告警，避免循环链接与越界）； 符号链接文件指向目录内的普通文件时按普通 JSON
 * 文件检查，失效链接或指向目录外的链接会记录为错误，不会被静默跳过。
 *
 * @param path 目录路径
 * @throws {AggregateError} 当目录遍历、文件读取或 JSON 解析失败时抛出，`errors` 中包含去重后的具体错误
 * @internal
 */
export const checkJSON = async (path: string): Promise<void> => {
  /** 已记录的错误，按错误类型与路径去重 */
  const failures = new Map<string, Error>();

  const reportFailure = (key: string, error: Error): void => {
    if (failures.has(key)) return;

    failures.set(key, error);
    console.error(error.message);
  };

  /** 目录 realpath，用于判断符号链接是否越界 */
  let rootReal = nodePath.resolve(path);

  try {
    rootReal = realpathSync(path);
  } catch {
    // 目录不存在或不可访问时，交给随后的 readdir 报告
  }

  /** 待检查的 JSON 文件路径 */
  const files: string[] = [];
  const context: JSONCheckContext = { files, reportFailure };
  /** 待遍历的目录，逐层处理以限制并发 */
  let pendingDirectories = [path];

  while (pendingDirectories.length > 0) {
    const directories = pendingDirectories;

    pendingDirectories = [];

    // oxlint-disable-next-line no-await-in-loop -- intentionally process one directory level at a time
    const directoryResults = await createPromiseQueue(
      directories.map((directory) => async (): Promise<DirectoryScan> => {
        try {
          return { directory, entries: await readdir(directory, { withFileTypes: true }) };
        } catch (err) {
          reportFailure(
            `directory:${directory}`,
            new Error(`读取目录 ${directory} 失败: ${getErrorMessage(err)}`, { cause: err }),
          );

          return { directory, entries: [] };
        }
      }),
      MAX_CONCURRENCY,
    );

    for (const { directory, entries } of directoryResults) {
      for (const entry of entries) {
        const entryPath = nodePath.join(directory, entry.name);

        if (entry.isSymbolicLink())
          collectJSONSymbolicLink(context, entryPath, entry.name, rootReal);
        else if (entry.isDirectory()) pendingDirectories.push(entryPath);
        else if (isJSONFile(entry.name)) files.push(entryPath);
      }
    }
  }

  await createPromiseQueue(
    files.map((file) => async (): Promise<void> => {
      let content: string;

      try {
        content = await readFile(file, "utf-8");
      } catch (err) {
        reportFailure(
          `file:${file}`,
          new Error(`读取文件 ${file} 失败: ${getErrorMessage(err)}`, { cause: err }),
        );

        return;
      }

      try {
        JSON.parse(content);
      } catch {
        reportFailure(`json:${file}`, new Error(`${file} 不是一个正确的 JSON 文件`));
      }
    }),
    MAX_CONCURRENCY,
  );

  if (failures.size > 0) {
    const errors = [...failures.values()];

    throw new AggregateError(
      errors,
      `检查目录 ${path} 失败: 共 ${errors.length} 个错误（首个错误: ${getErrorMessage(errors[0])}）`,
    );
  }
};
