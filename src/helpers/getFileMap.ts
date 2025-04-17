import { readFileSync, readdirSync, statSync } from "node:fs";

import upath from "upath";

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
      const itemPath = upath.join(folder, item);

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

export const getFileMap = (folder: string, ext?: string): FileMapItem[] =>
  getFileMapInfo(folder, ext);
