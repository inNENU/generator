import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import nodePath from "node:path";

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

/**
 * 检查目录下所有 JSON 文件
 *
 * 目录遍历与文件解析均使用有界并发，避免大型目录树触发 EMFILE。 读取或解析失败的文件只报告一次，并收集所有错误后统一抛出。
 *
 * @param path 目录路径
 * @throws {AggregateError} 当目录遍历、文件读取或 JSON 解析失败时抛出，`errors` 中包含去重后的具体错误
 */
export const checkJSON = async (path: string): Promise<void> => {
  /** 已记录的错误，按错误类型与路径去重 */
  const failures = new Map<string, Error>();

  const reportFailure = (key: string, error: Error): void => {
    if (failures.has(key)) return;

    failures.set(key, error);
    console.error(error.message);
  };

  /** 待检查的 JSON 文件路径 */
  const files: string[] = [];
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

        if (entry.isDirectory()) pendingDirectories.push(entryPath);
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
      `检查目录 ${path} 失败:\n${errors.map((error) => `- ${error.message}`).join("\n")}`,
    );
  }
};
