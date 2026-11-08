import { readdirSync, statSync } from "node:fs";

import { isAbsolute, join, resolve } from "upath";

export interface DirContent {
  /** 文件夹 */
  dirs: string[];
  /** 文件 */
  files: string[];
}

const getFiles = (base: string, ext: string, dir = ""): string[] => {
  const dirPath = resolve(base, dir);

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

/**
 * 获取目录下的文件列表
 *
 * @param dirPath 目录路径，绝对路径直接使用，相对路径基于 cwd 解析
 * @param ext 文件扩展名，不传则返回所有文件
 * @param cwd 解析相对路径时使用的工作目录，默认为 process.cwd()
 * @returns 相对于 dirPath 的文件路径列表
 * @throws {Error} 当解析后的路径不存在或不是目录时抛出错误
 */
export const getFileList = (dirPath: string, ext?: string, cwd = process.cwd()): string[] => {
  const base = isAbsolute(dirPath) ? resolve(dirPath) : resolve(cwd, dirPath);

  let baseStat;

  try {
    baseStat = statSync(base);
  } catch {
    throw new Error(`目录不存在: ${base}`);
  }

  if (!baseStat.isDirectory()) throw new Error(`路径不是目录: ${base}`);

  return getFiles(base, ext ? `.${ext}` : "");
};
