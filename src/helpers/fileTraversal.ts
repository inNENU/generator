import { readdirSync, realpathSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import nodePath from "node:path";

import { join, resolve } from "upath";

/** 文件扩展名过滤条件：单个扩展名（不含 `.`）或扩展名列表 */
export type FileExtension = string | readonly string[];

/** 遍历目录时共享的状态 */
export interface TraversalState {
  /** 带 `.` 的扩展名后缀列表 */
  suffixes: readonly string[];
  /** 源目录的 realpath */
  rootReal: string;
  /** 目录树中普通文件的 realpath 集合 */
  realFiles: ReadonlySet<string>;
  /** 已访问目录的 realpath 集合 */
  visitedDirs: Set<string>;
  /** 已访问符号链接目标的 realpath 集合 */
  visitedFiles: Set<string>;
}

/**
 * 按文件名比较两个目录项
 *
 * 使用 code unit 顺序而不是 `localeCompare`，避免不同系统语言环境产生不同排序结果。
 *
 * @param a 文件名 a
 * @param b 文件名 b
 * @returns 负数表示 a 在前，正数表示 b 在前，0 表示相同
 */
export const compareFileName = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;

  return 0;
};

/**
 * 按文件名对目录项排序
 *
 * @param entries 目录项
 * @returns 排序后的新数组
 */
export const sortDirEntries = (entries: Dirent[]): Dirent[] =>
  entries.toSorted((a, b) => compareFileName(a.name, b.name));

/**
 * 读取并按文件名排序的目录项
 *
 * @param directory 目录路径
 * @returns 排序后的目录项
 */
export const readSortedDir = (directory: string): Dirent[] =>
  sortDirEntries(readdirSync(directory, { withFileTypes: true }));

/**
 * 规范化扩展名过滤条件
 *
 * @param ext 扩展名（不含 `.`）或扩展名列表，为空时不限制扩展名
 * @returns 带 `.` 的扩展名后缀列表
 */
export const getExtensionSuffixes = (ext?: FileExtension): string[] => {
  if (ext === void 0 || ext === "") return [];

  const extensions = typeof ext === "string" ? [ext] : ext;

  return extensions.filter((extension) => extension !== "").map((extension) => `.${extension}`);
};

/**
 * 判断文件名是否匹配扩展名
 *
 * 扩展名区分大小写，与现有 `.yml` / `.json` 行为保持一致。
 *
 * @param fileName 文件名
 * @param suffixes 带 `.` 的扩展名后缀列表，为空时匹配所有文件
 * @returns 是否匹配
 */
export const matchesExtension = (fileName: string, suffixes: readonly string[]): boolean =>
  suffixes.length === 0 || suffixes.some((suffix) => fileName.endsWith(suffix));

/**
 * 判断目标路径是否位于指定目录内
 *
 * 使用 `path.relative` 判断，兼容不同平台的分隔符与盘符；目标与目录相同时视为位于目录内。
 *
 * @param directory 目录的 realpath
 * @param target 目标的 realpath
 * @returns 是否位于目录内
 */
export const isPathInside = (directory: string, target: string): boolean => {
  const relativePath = nodePath.relative(directory, target);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${nodePath.sep}`) &&
      !nodePath.isAbsolute(relativePath))
  );
};

/**
 * 解析符号链接文件的目标
 *
 * 只接受指向普通文件、且目标 realpath 位于源目录内的链接；失效链接、目录链接与越界链接都返回 `undefined`。
 *
 * @param itemPath 符号链接路径
 * @param rootReal 源目录的 realpath
 * @returns 目标的 realpath，不可用时返回 `undefined`
 */
export const resolveFileSymlink = (itemPath: string, rootReal: string): string | undefined => {
  let targetStat;

  try {
    targetStat = statSync(itemPath);
  } catch {
    // 失效链接或循环链接（ELOOP）直接跳过
    return void 0;
  }

  if (!targetStat.isFile()) return void 0;

  let targetReal: string;

  try {
    targetReal = realpathSync(itemPath);
  } catch {
    return void 0;
  }

  return isPathInside(rootReal, targetReal) ? targetReal : void 0;
};

/**
 * 收集目录树中所有普通文件（不跟随符号链接）的 realpath
 *
 * 用于让真实文件优先于指向它的符号链接：同一份内容只按真实路径枚举一次，避免输出路径取决于链接名与排序的巧合。
 *
 * @param root 源目录
 * @param suffixes 带 `.` 的扩展名后缀列表，为空时不限制扩展名
 * @returns 匹配扩展名的普通文件 realpath 集合
 */
export const collectRealFilePaths = (root: string, suffixes: readonly string[]): Set<string> => {
  const realFiles = new Set<string>();
  const visitedDirs = new Set<string>();

  const walk = (directory: string): void => {
    let realDirectory: string;

    try {
      realDirectory = realpathSync(directory);
    } catch {
      return;
    }

    if (visitedDirs.has(realDirectory)) return;

    visitedDirs.add(realDirectory);

    for (const entry of readSortedDir(directory)) {
      const itemPath = join(directory, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.isFile()) {
        if (!matchesExtension(entry.name, suffixes)) continue;

        try {
          realFiles.add(realpathSync(itemPath));
        } catch {
          // 遍历期间文件消失或不可访问时跳过
        }
      } else if (entry.isDirectory()) {
        walk(itemPath);
      }
    }
  };

  walk(resolve(root));

  return realFiles;
};
