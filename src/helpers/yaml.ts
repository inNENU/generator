import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import { JSON_SCHEMA, load } from "js-yaml";
import { resolve, relative, dirname, join } from "upath";

import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";

/** 单个 YAML 文档允许的最大别名节点数 */
const MAX_YAML_ALIASES = 100;

/** 单个 YAML 文档展开后允许访问的最大节点数，用于阻止别名指数膨胀 */
const MAX_YAML_EXPANDED_NODES = 100_000;

/**
 * 校验解析结果可以安全序列化
 *
 * 别名会被 js-yaml 解析为共享引用，正常的重复引用可以复用；但自引用会形成环（`JSON.stringify` 会抛错）， 嵌套别名还可能指数级展开（俗称 YAML
 * 别名炸弹）。这里在返回前做一次带上限的展开遍历。
 *
 * @param value 解析结果
 * @param filePath 文件路径，仅用于错误信息
 */
const assertYamlValueSafe = (value: unknown, filePath: string): void => {
  const ancestors = new Set<object>();
  let visited = 0;

  const visit = (node: unknown): void => {
    visited += 1;

    if (visited > MAX_YAML_EXPANDED_NODES)
      throw new Error(`YAML 文档展开后过大，可能存在别名炸弹（文件: ${filePath}）`);

    if (typeof node !== "object" || node == null) return;

    if (ancestors.has(node)) throw new Error(`YAML 文档存在循环引用（文件: ${filePath}）`);

    ancestors.add(node);

    if (Array.isArray(node)) for (const item of node) visit(item);
    else for (const item of Object.values(node)) visit(item);

    ancestors.delete(node);
  };

  visit(value);
};

/**
 * 判断 YAML 内容是否包含实际文档
 *
 * @param content YAML 内容
 * @returns 是否包含非空、非注释行
 */
const hasYamlDocument = (content: string): boolean =>
  content.split("\n").some((line) => line.trim() !== "" && !line.trimStart().startsWith("#"));

/**
 * 解析 YAML 内容
 *
 * 空文件或仅包含注释时返回 `undefined`；解析失败时抛出带文件路径的中文错误，便于定位批量转换中的具体文件。
 *
 * @param content YAML 内容
 * @param filePath 文件路径，仅用于错误信息
 * @returns 解析结果，空文档为 `undefined`
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const parseYaml = <T = unknown>(content: string, filePath = ""): T | undefined => {
  if (!hasYamlDocument(content)) return void 0;

  try {
    const value = load(content, { maxAliases: MAX_YAML_ALIASES, schema: JSON_SCHEMA }) as
      | T
      | undefined;

    if (value !== void 0) assertYamlValueSafe(value, filePath);

    return value;
  } catch (err) {
    const location = filePath ? `（文件: ${filePath}）` : "";

    throw new Error(
      `YAML 解析失败${location}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
};

/**
 * 匹配会被 YAML 解析成非字符串的纯标量
 *
 * 例如 `123`、`true`、`null`、`0x1A`、`2024-01-01` 直接写进 frontmatter 会变成 number/boolean/null/Date。
 */
const ambiguousScalarPattern =
  /^(?:~|null|true|false|yes|no|on|off|[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|0x[\da-f]+|0o[0-7]+|0b[01]+|[-+]?\.(?:inf|nan)|\d{4}-\d{2}-\d{2}(?:[Tt ].*)?)$/iu;

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
      /^\s|\s$/u.test(content) ||
      ambiguousScalarPattern.test(content));

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
    const absolutePath = resolve(sourceFolder, filePath);
    const json = parseYaml<T>(content, absolutePath);

    if (json === void 0) {
      console.warn(`空 YAML 文件已跳过: ${absolutePath}`);
      return;
    }

    checker(json, relative("./", filePath.replace(/\.yml$/u, "")));
  });
};

/**
 * 原子写入文件：先写临时文件再 rename，避免中途失败留下半截内容
 *
 * @param filename 目标文件路径
 * @param content 文件内容
 */
const writeFileAtomically = (filename: string, content: string): void => {
  const tempFilename = `${filename}.${process.pid}.tmp`;

  try {
    writeFileSync(tempFilename, content, { encoding: "utf-8" });
    renameSync(tempFilename, filename);
  } catch (err) {
    rmSync(tempFilename, { force: true });
    throw err;
  }
};

/**
 * 清理目标文件夹中源文件已不存在的旧输出
 *
 * 仅在源与目标文件夹不同时执行，避免误删与生成无关的文件。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 * @param extension 目标文件扩展名
 */
const removeStaleOutputs = (
  sourceFolder: string,
  targetFolder: string,
  extension: ".json" | ".md",
): void => {
  if (resolve(sourceFolder) === resolve(targetFolder)) return;
  if (!existsSync(targetFolder)) return;

  for (const filePath of getFileList(targetFolder, extension.slice(1))) {
    const targetFilename = resolve(targetFolder, filePath);
    const sourceBase = filePath.endsWith(extension)
      ? filePath.slice(0, -extension.length)
      : filePath;
    const candidates = [`${sourceBase}.yml`, `${sourceBase}.yaml`];

    if (extension === ".md" && /(?:^|\/)README\.md$/u.test(filePath)) {
      const dirnamePrefix = filePath.replace(/README\.md$/u, "");
      candidates.push(`${dirnamePrefix}index.yml`, `${dirnamePrefix}index.yaml`);
    }

    const hasSource = candidates.some((candidate) => existsSync(resolve(sourceFolder, candidate)));

    if (!hasSource) {
      rmSync(targetFilename, { force: true });
      console.warn(`已移除陈旧的输出文件: ${targetFilename}`);
    }
  }
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
  const errors: Error[] = [];

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, filePath.replace(/\.yml$/u, ".json"));
    const targetFolderPath = dirname(targetFilename);
    const yamlRelativePath = relative("./", filePath.replace(/\.yml$/u, ""));

    try {
      const content = readFileSync(sourceFilename, { encoding: "utf-8" });
      const finalContent = processFunction?.(content, yamlRelativePath) ?? content;
      const parsed = parseYaml<T>(finalContent, sourceFilename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${sourceFilename}`);
        return;
      }

      const result = convertFunction(parsed, yamlRelativePath);

      if (result !== void 0) {
        if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

        writeFileAtomically(targetFilename, JSON.stringify(result));
      }
    } catch (err) {
      errors.push(
        new Error(`YAML 转 JSON 失败: ${sourceFilename}`, {
          cause: err,
        }),
      );
    }
  });

  if (errors.length > 0)
    throw new AggregateError(errors, `YAML 转 JSON 失败（${errors.length} 个文件）`);

  removeStaleOutputs(sourceFolder, targetFolder, ".json");
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
  const errors: Error[] = [];

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(
      targetFolder,
      filePath.replace(/\.yml$/u, ".md").replace(/(?<sep>\/|^)index.md$/u, "$<sep>README.md"),
    );
    const targetFolderPath = dirname(targetFilename);

    try {
      const content = readFileSync(sourceFilename, { encoding: "utf-8" });
      const parsed = parseYaml<T>(content, sourceFilename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${sourceFilename}`);
        return;
      }

      const result = convertFunction(parsed, relative("./", filePath.replace(/\.yml$/u, "")));

      if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

      writeFileAtomically(targetFilename, result);
    } catch (err) {
      errors.push(
        new Error(`YAML 转 Markdown 失败: ${sourceFilename}`, {
          cause: err,
        }),
      );
    }
  });

  if (errors.length > 0)
    throw new AggregateError(errors, `YAML 转 Markdown 失败（${errors.length} 个文件）`);

  removeStaleOutputs(sourceFolder, targetFolder, ".md");
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
      const parsed = parseYaml<T>(content, filename);

      if (parsed === void 0) throw new Error(`YAML 文件为空: ${filename}`);

      return {
        type: "file",
        filename: item.filename,
        value: convertFunction(parsed, filename.replace(/\.yml$/u, "")),
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
