import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";

import { join, resolve } from "upath";

export interface DirContent {
  /** 文件夹 */
  dirs: string[];
  /** 文件 */
  files: string[];
}

const getFiles = (base: string, ext: string, dir = ""): string[] => {
  const dirPath = resolve(base, dir);

  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });

  const dirList: string[] = [];
  const fileList: string[] = [];

  readdirSync(dirPath).forEach((item) => {
    const itemPath = resolve(dirPath, item);

    if (statSync(itemPath).isFile()) fileList.push(item);
    else if (statSync(itemPath).isDirectory()) dirList.push(item);
  });

  return [
    ...fileList
      .filter((filename) => !ext || filename.endsWith(ext))
      .map((filePath) => join(dir, filePath)),
    ...dirList.flatMap((dirname) => getFiles(base, ext, join(dir, dirname))),
  ];
};

export const getFileList = (dirPath: string, ext?: string, cwd = process.cwd()): string[] =>
  getFiles(join(cwd, dirPath), ext ? `.${ext}` : "");
