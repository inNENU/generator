import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";

import { join, resolve } from "upath";

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
 * 按名称排序目录项，保证遍历顺序稳定
 *
 * @param entries 目录项
 * @returns 排序后的目录项
 */
const sortDirEntries = (entries: Dirent[]): Dirent[] =>
  entries.sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;

    return 0;
  });

/**
 * 读取目录下的文件映射
 *
 * - 目录项按名称排序，保证生成结果可复现
 * - 符号链接目录一律跳过（不递归），避免循环链接导致无限递归；符号链接文件会读取其目标内容
 * - 已访问目录通过 realpath 记录，重复到达时直接跳过
 *
 * @param folder 文件夹路径
 * @param suffix 文件扩展名后缀（如 `.yml`），为空时包含所有文件
 * @param visitedDirs 已访问目录的 realpath 集合
 * @returns 文件映射列表
 */
const getFileMapInfo = (
  folder: string,
  suffix: string,
  visitedDirs: Set<string>,
): FileMapItem[] | null => {
  const realFolder = realpathSync(folder);

  if (visitedDirs.has(realFolder)) return null;

  visitedDirs.add(realFolder);

  const entries = sortDirEntries(readdirSync(folder, { withFileTypes: true }));
  const result: FileMapItem[] = [];

  entries.forEach((entry) => {
    const itemPath = join(folder, entry.name);
    const matched = !suffix || entry.name.endsWith(suffix);

    if (entry.isSymbolicLink()) {
      // 符号链接目录不递归，避免循环链接；仅读取指向文件的链接
      let targetStat;

      try {
        targetStat = statSync(itemPath);
      } catch {
        // 跳过失效的符号链接
        return;
      }

      if (targetStat.isFile() && matched) {
        result.push({
          type: "file",
          filename: entry.name,
          content: readFileSync(itemPath, { encoding: "utf-8" }),
        });
      }

      return;
    }

    if (entry.isDirectory()) {
      const content = getFileMapInfo(itemPath, suffix, visitedDirs);

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
 * - 目录项按名称升序排列，同一目录结构的输出始终一致
 * - 符号链接目录会被跳过（不递归），符号链接文件会读取其指向的文件内容
 * - 失效的符号链接会被忽略
 *
 * @param folder 文件夹路径，相对路径基于 cwd 解析
 * @param ext 文件扩展名，不传则返回所有文件
 * @returns 文件映射列表
 * @throws {Error} 当解析后的路径不存在或不是目录时抛出错误
 */
export const getFileMap = (folder: string, ext?: string): FileMapItem[] => {
  const base = resolve(folder);

  let baseStat;

  try {
    baseStat = statSync(base);
  } catch {
    throw new Error(`目录不存在: ${base}`);
  }

  if (!baseStat.isDirectory()) throw new Error(`路径不是目录: ${base}`);

  return getFileMapInfo(base, ext ? `.${ext}` : "", new Set()) ?? [];
};
