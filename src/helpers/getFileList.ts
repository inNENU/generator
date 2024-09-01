import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";

import upath from "upath";

export interface DirContent {
  /** 文件夹 */
  dirs: string[];
  /** 文件 */
  files: string[];
}

const getFiles = (base: string, dir = "", ext?: string): string[] => {
  const dirPath = upath.resolve(base, dir);

  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });

  const dirList: string[] = [];
  const fileList: string[] = [];

  readdirSync(dirPath).forEach((item) => {
    const itemPath = upath.resolve(dirPath, item);

    if (statSync(itemPath).isFile()) fileList.push(item);
    else if (statSync(itemPath).isDirectory()) dirList.push(item);
  });

  return [
    ...fileList
      .filter((filename) => (ext ? filename.endsWith(ext) : true))
      .map((filePath) => upath.relative("./", upath.resolve(dir, filePath))),
    ...dirList
      .map((dirname) =>
        getFiles(base, upath.relative("./", upath.resolve(dir, dirname)), ext),
      )
      .flat(),
  ];
};

export const getFileList = (dirPath: string, ext?: string): string[] =>
  getFiles(dirPath, "", ext);
