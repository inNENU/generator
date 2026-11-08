import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import type { Schema } from "js-yaml";
import { JSON_SCHEMA, NOT_RESOLVED, defineScalarTag, intJsonTag, load } from "js-yaml";
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

/** JavaScript 安全整数上限，超出该范围的整数无法用 `number` 精确表示 */
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * 对超出 JavaScript 安全整数范围的整数原文打印告警
 *
 * @param source 整数原文
 * @param filePath 文件路径，仅用于告警信息
 */
const warnIfUnsafeInteger = (source: string, filePath: string): void => {
  const signless = source.replaceAll("_", "").replace(/^[+-]/u, "");
  const negative = source.startsWith("-");
  let value: bigint;

  try {
    value = BigInt(signless);
  } catch {
    // 不是合法的整数原文（例如显式标签匹配到的其它写法），交给解析器自行处理
    return;
  }

  if (negative) value = -value;
  if (value >= -MAX_SAFE_INTEGER_BIGINT && value <= MAX_SAFE_INTEGER_BIGINT) return;

  const location = filePath ? `（文件: ${filePath}）` : "";

  console.warn(
    `YAML 大整数超出安全整数范围，解析为 number 时可能丢失精度${location}: ${source}；长数字请加引号，以按字符串保留原始值`,
  );
};

/**
 * 创建带大整数告警的 YAML schema
 *
 * 在 js-yaml 默认 JSON schema 的基础上替换整数标签：仍按原逻辑解析，但整数超出 JavaScript 安全整数范围时打印告警，避免静默丢失精度。
 *
 * @param filePath 文件路径，仅用于告警信息
 * @returns 用于本次解析的 schema
 */
const createYamlSchema = (filePath: string): Schema =>
  JSON_SCHEMA.withTags(
    defineScalarTag<number>("tag:yaml.org,2002:int", {
      implicit: true,
      implicitFirstChars: ["-", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      identify: intJsonTag.identify,
      represent: intJsonTag.represent,
      resolve: (source, isExplicit, tagName) => {
        const value = intJsonTag.resolve(source, isExplicit, tagName);

        if (value !== NOT_RESOLVED) warnIfUnsafeInteger(source, filePath);

        return value;
      },
    }),
  );

/**
 * 匹配位于第 0 列的文档标记行（`---`、`...`）
 *
 * 按 YAML 规范，文档标记必须从第 0 列开始，后面只允许空白或注释；缩进的 `...`/`---` 属于普通标量，不是文档标记。
 */
const yamlDocumentMarkerPattern = /^(?:---|\.\.\.)(?:\s+(?:#.*)?)?$/u;

/**
 * 判断 YAML 内容是否包含实际文档
 *
 * 空行、注释、文档标记（`---`/`...`）与指令（`%YAML`/`%TAG`）都不构成文档内容，只有这些行的文件按空文档处理。 由于文档标记与指令必须位于第 0 列，缩进的
 * `...`、`---` 会被当作普通标量内容，缩进的 `%foo` 也不再被误判为空文档。
 *
 * @param content YAML 内容
 * @returns 是否包含实际标量内容
 */
const hasYamlDocument = (content: string): boolean => {
  // 去掉文件开头的 BOM，避免首行的文档标记被当成普通内容
  const normalizedContent = content.startsWith("\uFEFF") ? content.slice(1) : content;

  return normalizedContent.split("\n").some((line) => {
    if (line.trim() === "") return false;
    if (line.trimStart().startsWith("#")) return false;
    if (line.startsWith("%")) return false;

    return !yamlDocumentMarkerPattern.test(line);
  });
};

/**
 * 解析 YAML 内容
 *
 * 空文件、仅包含注释、或仅包含文档标记/指令时返回 `undefined`；解析失败时抛出带文件路径的中文错误，便于定位批量转换中的具体文件。 未加引号的整数超出 JavaScript
 * 安全整数范围时会打印告警：解析结果仍是 `number`，但可能已丢失精度，需要保留原始值时请加引号按字符串处理。
 *
 * @param content YAML 内容
 * @param filePath 文件路径，仅用于错误与告警信息
 * @returns 解析结果，无标量文档为 `undefined`
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const parseYaml = <T = unknown>(content: string, filePath = ""): T | undefined => {
  if (!hasYamlDocument(content)) return void 0;

  try {
    const value = load(content, {
      maxAliases: MAX_YAML_ALIASES,
      schema: createYamlSchema(filePath),
    }) as T | undefined;

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
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值；返回 `null`/`undefined` 时跳过该文件
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

      // `null`/`undefined` 表示调用方要求跳过该文件；`""`、`0`、`false` 是有效输出，需要正常写出
      if (result != null) {
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
 * 与 `convertYamlFilesToJson` 不同，本函数不把转换函数返回的 `null`/`undefined` 视为“跳过”： 转换函数被声明为返回
 * `string`，当前消费者都返回 Markdown 文本；若运行时返回 `null`/`undefined`， 写入会失败并计入聚合错误，而不是静默跳过该文件。
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
 * 与其它 YAML 辅助函数一致，空文档（空文件、纯注释、仅文档标记/指令）会被跳过并打印中文告警，而不是抛错中断整个映射；空目录仍会保留。
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

  const convertYaml = (base: string, item: FileMapItem): YamlMapItem<Value> | undefined => {
    if (item.type === "file") {
      const filename = join(base, item.filename);
      const content = readFileSync(filename, { encoding: "utf-8" });
      const parsed = parseYaml<T>(content, filename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${filename}`);
        return void 0;
      }

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
      content: item.content
        .map((block) => convertYaml(itemDirname, block))
        .filter((child): child is YamlMapItem<Value> => child !== void 0),
    };
  };

  return fileMap
    .map((item) => convertYaml(sourceFolder, item))
    .filter((item): item is YamlMapItem<Value> => item !== void 0);
};
