import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { JSON_SCHEMA, load } from "js-yaml";
import upath from "upath";

import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";

export const getYamlValue = (content: string): string =>
  content.startsWith("@") || content.includes(": ")
    ? `"${content.replaceAll('"', String.raw`\"`)}"`
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
    const json = load(content, { schema: JSON_SCHEMA }) as T;

    checker(json, upath.relative("./", filePath.replace(/\.yml$/u, "")));
  });
};

export const convertYamlFilesToJson = <T = unknown, Value = T>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
  processFunction?: (content: string, filePath: string) => string,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const sourceFilename = upath.resolve(sourceFolder, filePath);
    const targetFilename = upath.resolve(targetFolder, filePath.replace(/\.yml$/u, ".json"));
    const targetFolderPath = upath.dirname(targetFilename);

    if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });
    const yamlRelativePath = upath.relative("./", filePath.replace(/\.yml$/u, ""));

    const finalContent = processFunction?.(content, yamlRelativePath) ?? content;

    const result = convertFunction(
      load(finalContent, { schema: JSON_SCHEMA }) as T,
      yamlRelativePath,
    );

    if (result) {
      writeFileSync(targetFilename, JSON.stringify(result), {
        encoding: "utf-8",
      });
    }
  });
};

export const convertYamlFilesToMarkdown = <T = unknown>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => string,
  targetFolder = sourceFolder,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const sourceFilename = upath.resolve(sourceFolder, filePath);
    const targetFilename = upath.resolve(
      targetFolder,
      filePath.replace(/\.yml$/u, ".md").replace(/(\/|^)index.md$/, "$1README.md"),
    );
    const targetFolderPath = upath.dirname(targetFilename);

    if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const result = convertFunction(
      load(content, { schema: JSON_SCHEMA }) as T,
      upath.relative("./", filePath.replace(/\.yml$/u, "")),
    );

    writeFileSync(targetFilename, result, { encoding: "utf-8" });
  });
};

export interface YamlInfo<Value = unknown> {
  type: "file";
  filename: string;
  value: Value;
}

export interface YamlDirInfo<Value = unknown> {
  type: "dir";
  dirname: string;
  content: YamlMapItem<Value>[];
}

export type YamlMapItem<Value> = YamlInfo<Value> | YamlDirInfo<Value>;

export const getYamlMap = <T = unknown, Value = T>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
): YamlMapItem<Value>[] => {
  const fileMap = getFileMap(sourceFolder, "yml");

  const convertYaml = (base: string, item: FileMapItem): YamlMapItem<Value> => {
    if (item.type === "file") {
      const filename = upath.join(base, item.filename);
      const content = readFileSync(filename, { encoding: "utf-8" });

      return {
        type: "file",
        filename: item.filename,
        value: convertFunction(
          load(content, { schema: JSON_SCHEMA }) as T,
          filename.replace(/\.yml$/u, ""),
        ),
      };
    }

    const dirname = upath.join(base, item.dirname);

    return {
      type: "dir",
      dirname: item.dirname,
      content: item.content.map((block) => convertYaml(dirname, block)),
    };
  };

  return fileMap.map((item) => convertYaml(sourceFolder, item));
};
