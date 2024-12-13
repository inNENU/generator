import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { load } from "js-yaml";
import upath from "upath";

import { getFileList } from "./getFileList.js";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const convertYamlFilesToMarkdown = <T = unknown>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => string,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const sourceFilename = upath.resolve(sourceFolder, filePath);
    const targetFilename = upath.resolve(
      targetFolder,
      filePath
        .replace(/\.yml$/u, ".md")
        .replace(/(\/|^)index.md$/, "$1README.md"),
    );
    const targetFolderPath = upath.dirname(targetFilename);

    if (!existsSync(targetFolderPath))
      mkdirSync(targetFolderPath, { recursive: true });

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const result = convertFunction(
      load(content) as T,
      upath.relative("./", filePath.replace(/\.yml$/u, "")),
    );

    writeFileSync(targetFilename, result, { encoding: "utf-8" });
  });
};
