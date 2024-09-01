import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { load } from "js-yaml";
import upath from "upath";

import { getFileList } from "./getFileList.js";

export const getYamlValue = (content: string): string =>
  content.startsWith("@") || content.includes(": ")
    ? `"${content.replace(/"/g, '\\"')}"`
    : content;

export const checkYamlFiles = <T = unknown>(
  sourceFolder: string,
  checker: (data: T, filePath: string) => void,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const content = readFileSync(upath.resolve(sourceFolder, filePath), {
      encoding: "utf-8",
    });
    const json = load(content) as T;

    checker(json, upath.relative("./", filePath.replace(/\.yml$/u, "")));
  });
};

export const convertYamlFilesToJson = <T = unknown, U = T>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => U = (data): U =>
    data as unknown as U,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const folderPath = upath.dirname(upath.resolve(targetFolder, filePath));

    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });

    const content = readFileSync(upath.resolve(sourceFolder, filePath), {
      encoding: "utf-8",
    });
    const json = load(content) as T;

    const result = convertFunction(
      json,
      upath.relative("./", filePath.replace(/\.yml$/u, "")),
    );

    if (result)
      writeFileSync(
        upath.resolve(targetFolder, filePath.replace(/\.yml$/u, ".json")),
        JSON.stringify(result),
        { encoding: "utf-8" },
      );
  });
};
