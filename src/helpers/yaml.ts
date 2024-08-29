import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { load } from "js-yaml";

import { getFileList } from "./fs.js";

export const getYAMLValue = (content: string): string =>
  content.startsWith("@") || content.includes(": ")
    ? `"${content.replace(/"/g, '\\"')}"`
    : content;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const convertYml2Json = <T = any, U = T>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => U = (data): U =>
    data as unknown as U,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const folderPath = dirname(resolve(targetFolder, filePath));

    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });

    const content = readFileSync(resolve(sourceFolder, filePath), {
      encoding: "utf-8",
    });
    const json = load(content) as T;

    const result = convertFunction(
      json,
      relative("./", resolve(filePath.replace(/\.yml/u, ""))).replace(
        /\\/gu,
        "/",
      ),
    );

    if (result)
      writeFileSync(
        resolve(targetFolder, filePath.replace(/\.yml/u, ".json")),
        JSON.stringify(result),
        { encoding: "utf-8" },
      );
  });
};
