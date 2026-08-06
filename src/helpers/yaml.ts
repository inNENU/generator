import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { JSON_SCHEMA, load } from "js-yaml";
import { resolve, relative, dirname, join } from "upath";

import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";

/**
 * 获取 YAML 值
 *
 * @param content 内容
 * @returns 处理后的 YAML 值
 */
export const getYamlValue = (content: string): string => {
  const needsQuote =
    content.length > 0 &&
    (/^[@#?!&*%|>{}[\]"',`]/u.test(content) ||
      /^[-?:](?:\s|$)/u.test(content) ||
      /:\s| #|:$/u.test(content) ||
      /[\r\n]/u.test(content) ||
      /^\s|\s$/u.test(content));

  return needsQuote
    ? `"${content
        .replaceAll("\\", String.raw`\\`)
        .replaceAll('"', String.raw`\"`)
        .replaceAll("\r", String.raw`\r`)
        .replaceAll("\n", String.raw`\n`)}"`
    : content;
};

/**
 * 检查源文件夹下的所有 YAML 文件
 *
 * @param sourceFolder 源文件夹
 * @param checker 检查函数，接收解析后的数据与文件路径
 */
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

/**
 * 将源文件夹下的所有 YAML 文件转换为 JSON 文件
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹，默认为源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值
 * @param processFunction 内容处理函数，在解析前对 YAML 内容进行预处理
 */
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

/**
 * 将源文件夹下的所有 YAML 文件转换为 Markdown 文件
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回 Markdown 内容
 * @param targetFolder 目标文件夹，默认为源文件夹
 */
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
      filePath.replace(/\.yml$/u, ".md").replace(/(?<sep>\/|^)index.md$/u, "$<sep>README.md"),
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

/**
 * 获取源文件夹下的 YAML 文件映射
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值
 * @returns YAML 映射列表
 */
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
