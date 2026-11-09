import { readFileSync, realpathSync, statSync } from "node:fs";

import { join, resolve } from "upath";

import type { FileExtension, TraversalState } from "./fileTraversal.js";
import {
  collectRealFilePaths,
  getExtensionSuffixes,
  matchesExtension,
  readSortedDir,
  resolveFileSymlink,
} from "./fileTraversal.js";

export interface FileInfo {
  type: "file";
  filename: string;
  content: string;
}

export interface DirInfo {
  type: "dir";
  dirname: string;
  content: FileMapItem[];
}

export type FileMapItem = FileInfo | DirInfo;

/**
 * 读取目录下的文件映射
 *
 * - 目录项按文件名排序，保证生成结果可复现；
 * - 符号链接目录一律跳过（不递归），符号链接文件只在目标位于源目录内且为普通文件时读取；
 * - 真实文件优先于指向它的符号链接，链接目标按 realpath 去重；
 * - 已访问目录通过 realpath 记录，重复到达时直接跳过。
 *
 * @param state 遍历状态
 * @param folder 当前文件夹路径
 * @returns 文件映射列表
 */
const getFileMapInfo = (state: TraversalState, folder: string): FileMapItem[] | null => {
  const { suffixes, rootReal, realFiles, visitedDirs, visitedFiles } = state;
  const realFolder = realpathSync(folder);

  if (visitedDirs.has(realFolder)) return null;

  visitedDirs.add(realFolder);

  const entries = readSortedDir(folder);
  const result: FileMapItem[] = [];

  entries.forEach((entry) => {
    const itemPath = join(folder, entry.name);
    const matched = matchesExtension(entry.name, suffixes);

    if (entry.isSymbolicLink()) {
      const targetReal = resolveFileSymlink(itemPath, rootReal);

      if (!targetReal || !matched) return;
      if (realFiles.has(targetReal) || visitedFiles.has(targetReal)) return;

      visitedFiles.add(targetReal);
      result.push({
        type: "file",
        filename: entry.name,
        content: readFileSync(itemPath, { encoding: "utf-8" }),
      });
    } else if (entry.isDirectory()) {
      const content = getFileMapInfo(state, itemPath);

      if (content) {
        result.push({
          type: "dir",
          dirname: entry.name,
          content,
        });
      }
    } else if (entry.isFile() && matched) {
      result.push({
        type: "file",
        filename: entry.name,
        content: readFileSync(itemPath, { encoding: "utf-8" }),
      });
    }
  });

  return result;
};

/**
 * 获取目录下的文件映射
 *
 * - 目录项按文件名升序排列，同一目录结构的输出始终一致；
 * - 符号链接目录会被跳过（不递归），符号链接文件只在目标位于 `folder` 内时读取；
 * - 真实文件优先于指向它的符号链接，失效链接与越界链接会被忽略。
 *
 * @param folder 文件夹路径，相对路径基于 cwd 解析
 * @param ext 文件扩展名（不含 `.`），可传数组同时匹配多个扩展名；不传则返回所有文件
 * @returns 文件映射列表
 * @throws {Error} 当解析后的路径不存在或不是目录时抛出错误
 */
export const getFileMap = (folder: string, ext?: FileExtension): FileMapItem[] => {
  const base = resolve(folder);

  let baseStat;

  try {
    baseStat = statSync(base);
  } catch {
    throw new Error(`目录不存在: ${base}`);
  }

  if (!baseStat.isDirectory()) throw new Error(`路径不是目录: ${base}`);

  const suffixes = getExtensionSuffixes(ext);
  const rootReal = realpathSync(base);

  return (
    getFileMapInfo(
      {
        suffixes,
        rootReal,
        realFiles: collectRealFilePaths(base, suffixes),
        visitedDirs: new Set(),
        visitedFiles: new Set(),
      },
      base,
    ) ?? []
  );
};
