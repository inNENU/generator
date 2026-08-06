import { readFileSync, readdirSync, statSync } from "node:fs";

import { join } from "upath";

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

const getFileMapInfo = (folder: string, ext?: string): FileMapItem[] =>
  readdirSync(folder)
    .map((item) => {
      const itemPath = join(folder, item);

      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        return {
          type: "dir",
          dirname: item,
          content: getFileMapInfo(itemPath, ext),
        };
      } else if (stat.isFile() && (!ext || item.endsWith(`.${ext}`))) {
        return {
          type: "file",
          filename: item,
          content: readFileSync(itemPath, { encoding: "utf-8" }),
        };
      }

      return null;
    })
    .filter((item): item is FileMapItem => item != null);

/**
 * 获取目录下的文件映射
 *
 * @param folder 文件夹路径
 * @param ext 文件扩展名，不传则返回所有文件
 * @returns 文件映射列表
 */
export const getFileMap = (folder: string, ext?: string): FileMapItem[] =>
  getFileMapInfo(folder, ext);
