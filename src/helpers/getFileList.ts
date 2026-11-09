import { realpathSync, statSync } from "node:fs";

import { isAbsolute, join, resolve } from "upath";

import type { FileExtension, TraversalState } from "./fileTraversal.js";
import {
  collectRealFilePaths,
  getExtensionSuffixes,
  matchesExtension,
  readSortedDir,
  resolveFileSymlink,
} from "./fileTraversal.js";

export interface DirContent {
  /** 文件夹 */
  dirs: string[];
  /** 文件 */
  files: string[];
}

/**
 * 递归收集文件
 *
 * - 目录项按文件名（code unit）统一排序，文件直接输出、子目录就地递归，文件与目录交错；
 * - 符号链接目录一律不递归，避免循环链接与越出源目录；
 * - 符号链接文件只在目标位于源目录内且为普通文件时读取，并按 realpath 去重；
 * - 真实文件优先于指向它的符号链接，避免链接名改变输出路径。
 *
 * @param state 遍历状态
 * @param base 源目录
 * @param dir 相对源目录的当前目录
 * @returns 相对于源目录的文件路径列表
 */
const getFiles = (state: TraversalState, base: string, dir: string): string[] => {
  const { suffixes, rootReal, realFiles, visitedDirs, visitedFiles } = state;
  const dirPath = resolve(base, dir);

  let realDir: string;

  try {
    realDir = realpathSync(dirPath);
  } catch {
    return [];
  }

  if (visitedDirs.has(realDir)) return [];

  visitedDirs.add(realDir);

  const fileList: string[] = [];

  for (const entry of readSortedDir(dirPath)) {
    const itemPath = resolve(dirPath, entry.name);

    if (entry.isSymbolicLink()) {
      const targetReal = resolveFileSymlink(itemPath, rootReal);

      if (!targetReal || !matchesExtension(entry.name, suffixes)) continue;
      if (realFiles.has(targetReal) || visitedFiles.has(targetReal)) continue;

      visitedFiles.add(targetReal);
      fileList.push(join(dir, entry.name));
    } else if (entry.isFile()) {
      if (matchesExtension(entry.name, suffixes)) fileList.push(join(dir, entry.name));
    } else if (entry.isDirectory()) {
      fileList.push(...getFiles(state, base, join(dir, entry.name)));
    }
  }

  return fileList;
};

/**
 * 获取目录下的文件列表
 *
 * - 目录项按文件名（code unit）排序深度优先输出，文件与子目录交错在同一顺序中，跨平台结果一致；
 * - 符号链接目录不会被递归，符号链接文件只在目标位于 `dirPath` 内时读取，并按 realpath 去重；
 * - 失效链接、循环链接与指向目录外部的链接会被跳过。
 *
 * @param dirPath 目录路径，绝对路径直接使用，相对路径基于 cwd 解析
 * @param ext 文件扩展名（不含 `.`），可传数组同时匹配多个扩展名；不传则返回所有文件
 * @param cwd 解析相对路径时使用的工作目录，默认为 process.cwd()
 * @returns 相对于 dirPath 的文件路径列表
 * @throws {Error} 当解析后的路径不存在或不是目录时抛出错误
 */
export const getFileList = (
  dirPath: string,
  ext?: FileExtension,
  cwd = process.cwd(),
): string[] => {
  const base = isAbsolute(dirPath) ? resolve(dirPath) : resolve(cwd, dirPath);

  let baseStat;

  try {
    baseStat = statSync(base);
  } catch {
    throw new Error(`目录不存在: ${base}`);
  }

  if (!baseStat.isDirectory()) throw new Error(`路径不是目录: ${base}`);

  const suffixes = getExtensionSuffixes(ext);
  const rootReal = realpathSync(base);

  return getFiles(
    {
      suffixes,
      rootReal,
      realFiles: collectRealFilePaths(base, suffixes),
      visitedDirs: new Set(),
      visitedFiles: new Set(),
    },
    base,
    "",
  );
};
