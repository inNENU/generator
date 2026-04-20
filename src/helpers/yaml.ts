import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { JSON_SCHEMA, load } from "js-yaml";
import { resolve, relative, dirname, join } from "upath";

import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";

export const getYamlValue = (content: string): string =>
  content.startsWith("@") || content.includes(": ")
    ? `"${content.replaceAll('"', String.raw`\"`)}"`
    : content;

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const checkYamlFiles = <T = unknown>(
  sourceFolder: string,
  checker: (data: T, filePath: string) => void,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const content = readFileSync(resolve(sourceFolder, filePath), {
      encoding: "utf-8",
    });
    const json = load(content, { schema: JSON_SCHEMA }) as T;

    checker(json, relative("./", filePath.replace(/\.yml$/u, "")));
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
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, filePath.replace(/\.yml$/u, ".json"));
    const targetFolderPath = dirname(targetFilename);

    if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });
    const yamlRelativePath = relative("./", filePath.replace(/\.yml$/u, ""));

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

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const convertYamlFilesToMarkdown = <T = unknown>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => string,
  targetFolder = sourceFolder,
): void => {
  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(
      targetFolder,
      filePath.replace(/\.yml$/u, ".md").replace(/(\/|^)index.md$/, "$1README.md"),
    );
    const targetFolderPath = dirname(targetFilename);

    if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const result = convertFunction(
      load(content, { schema: JSON_SCHEMA }) as T,
      relative("./", filePath.replace(/\.yml$/u, "")),
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
      const filename = join(base, item.filename);
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

    const itemDirname = join(base, item.dirname);

    return {
      type: "dir",
      dirname: item.dirname,
      content: item.content.map((block) => convertYaml(itemDirname, block)),
    };
  };

  return fileMap.map((item) => convertYaml(sourceFolder, item));
};
