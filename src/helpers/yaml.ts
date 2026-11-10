import { existsSync, mkdirSync, readFileSync } from "node:fs";

import type { Schema } from "js-yaml";
import { JSON_SCHEMA, NOT_RESOLVED, defineScalarTag, intJsonTag, load } from "js-yaml";
import { dirname, join, relative, resolve } from "upath";
import { Composer, CST, Parser, isMap, isPair, isScalar, stringify as stringifyYaml } from "yaml";

import {
  getOutputRelativePath,
  syncGeneratedOutputs,
  writeFileAtomically,
} from "./generation-manifest.js";
import { getFileList } from "./getFileList.js";
import type { FileMapItem } from "./getFileMap.js";
import { getFileMap } from "./getFileMap.js";
import { stripYamlExtension, YAML_EXTENSIONS } from "./yamlPath.js";

export { removeStaleOutputs } from "./generation-manifest.js";

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
 * 文档标记后只允许空白或注释；这里按单行匹配，调用前已统一换行符并去掉 `\r`，所以 CRLF/CR 文件不会被漏判。
 */
const yamlDocumentMarkerPattern = /^(?:---|\.\.\.)(?:[ \t]+(?:#.*)?)?$/u;

/**
 * 匹配流起始处带缩进的 `---`
 *
 * 解析器（js-yaml）会把文件首行缩进的 `---`（可带行尾注释）当作文档开始标记，而不是普通标量；同样的内容出现在第二行及以后才是标量，因此只在首行应用。`...` 没有这个特例。
 */
const yamlIndentedStartMarkerPattern = /^[ \t]+---(?:[ \t]+(?:#.*)?)?$/u;

/**
 * 匹配 YAML 指令行
 *
 * 只承认规范定义的 `%YAML`/`%TAG`；其它第 0 列的 `%` 行不是可跳过的内容，交给 js-yaml 判定（可能是非法指令）。
 */
const yamlDirectivePattern = /^%(?:YAML|TAG)\b/u;

/**
 * 判断 YAML 内容是否包含实际文档
 *
 * 空行、注释、文档标记（`---`/`...`）与指令（`%YAML`/`%TAG`）都不构成文档内容。文件开头的 BOM 会先剥离，CRLF/CR 行尾按换行拆分，因此行尾不会影响判断。
 * 文档标记与指令按规范必须位于第 0 列，缩进的 `...` 属于普通标量；但 js-yaml 会把流起始处缩进的 `---` 当作文档开始标记，这里仅在首行与之保持一致。缩进的 `%foo`
 * 也不再被误判为空文档。
 *
 * @param content YAML 内容
 * @returns 是否包含实际标量内容
 */
const hasYamlDocument = (content: string): boolean => {
  // 去掉文件开头的 BOM，避免首行的文档标记被当成普通内容
  const normalizedContent = content.startsWith("\uFEFF") ? content.slice(1) : content;

  return normalizedContent.split(/\r\n?|\n/u).some((line, index) => {
    if (line.trim() === "") return false;
    if (line.trimStart().startsWith("#")) return false;

    // 拆分时已去掉行尾的 `\r`，标记与注释的匹配因此不受 CRLF/CR 影响
    if (yamlDirectivePattern.test(line)) return false;
    if (index === 0 && yamlIndentedStartMarkerPattern.test(line)) return false;

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
 * @internal
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
 * 获取 YAML 值
 *
 * @param content 内容
 * @returns 处理后的 YAML 值
 * @internal
 */
export const getYamlValue = (content: string): string => {
  // 含换行或首尾空白时，yaml 的跨行/折行输出不保证 frontmatter 仍是单行标量；这里直接改用 JSON 双引号转义，
  // 保证输出始终是单行且逐字符保留（首尾空白本来就需要引号，统一走 JSON 也更简单）。
  if (/[\r\n]/u.test(content) || /^\s|\s$/u.test(content)) return JSON.stringify(content);

  const serialized = stringifyYaml(content, {
    // 与 js-yaml 的 JSON_SCHEMA 行为对齐：YAML 1.1 会额外把 `y`/`n`、`1:20` 等视为非字符串
    schema: "yaml-1.1",
    // 不使用 `>` 折叠块，且不自动折行；frontmatter 单行标量更易读、diff 更稳定
    blockQuote: false,
    lineWidth: 0,
  });
  // stringify 只在末尾追加一个换行，不能整体 trimEnd（会吃掉值本身的尾部空白）
  const body = serialized.endsWith("\n") ? serialized.slice(0, -1) : serialized;

  // YAML 1.1 不认识 1.2 的 `0o` 八进制，会按普通字符串输出；VuePress 使用的 js-yaml 默认 schema 会把它解析成数字
  return body === content && /^[-+]?0o[0-7]+$/u.test(content) ? JSON.stringify(content) : body;
};

/**
 * 只更新 YAML 文本中顶层某个标量的值，保留注释、空行、引号风格与其余字节
 *
 * 基于 `yaml` 的 CST 源 token 编辑：解析出源 token → 定位顶层 key → 只替换目标标量的 token → 再把原 token 重新拼接。与整份
 * `Document.toString()` 不同，长标量不会被重新折行，flow 集合也不会被改写。
 *
 * @param content 原始 YAML 文本
 * @param key 顶层 key
 * @param value 新的标量内容（按标量内容写入，不是 YAML 源文本；不会被当作已引号化的片段）
 * @returns 更新后的文本；根不是 map、顶层不存在该 key、`key:` 后没有值、或目标不是标量（alias/flow 集合/嵌套 map）时返回 `null`
 * @throws {Error} YAML 无法解析时抛出
 */
export const updateYamlScalar = (content: string, key: string, value: string): string | null => {
  // 空文件/纯注释文件没有可更新的文档，按“字段不存在”处理，避免调用方把它当成解析错误
  if (content.replaceAll(/^[ \t]*#.*$/gmu, "").trim() === "") return null;

  const tokens = [...new Parser().parse(content)];
  const [document] = [...new Composer({ keepSourceTokens: true }).compose(tokens)];

  if (!document || document.errors.length > 0)
    throw new Error(`YAML 解析失败，无法更新 ${key} 字段`);

  const { contents } = document;

  if (!isMap(contents)) return null;

  const pair = contents.items.find(
    (item) => isPair(item) && isScalar(item.key) && item.key.value === key,
  );

  // `key:` 后没有值时没有可替换的 token，保持“字段不存在”的旧行为
  if (!pair || !isScalar(pair.value) || !pair.srcToken?.value) return null;

  const currentType = pair.value.type;
  const multiline = /[\r\n]/u.test(value);
  const blockScalar = currentType === "BLOCK_LITERAL" || currentType === "BLOCK_FOLDED";
  // flow collection 里不能用块标量，且逗号/方括号等会改变结构，统一退回双引号标量
  const inFlow = contents.flow === true;
  // 空字符串用双引号保持字符串语义（否则 js-yaml 与 yaml 对空节点分别读成 "" / null）
  const quote = inFlow || value.includes("\r") || value.length === 0;

  // 目标原本是块标量、或新值含换行/为空时，必须显式指定标量类型；否则 `CST.setScalarValue` 会把 body 顶到第 0 列或输出空节点。
  // 含 CR、空串或处于 flow collection 的值改用双引号转义，其余多行值用块标量。
  CST.setScalarValue(pair.srcToken.value, value, {
    afterKey: true,
    inFlow,
    ...(multiline || blockScalar || value.length === 0
      ? { type: quote ? "QUOTE_DOUBLE" : "BLOCK_LITERAL" }
      : {}),
  } as const);

  return tokens.map((token) => CST.stringify(token)).join("");
};

/**
 * 检查 YAML 源文件映射到目标文件时是否冲突
 *
 * `.yml` 与 `.yaml` 都可能被转换，例如同一目录下的 `a.yml` 与 `a.yaml` 会写出同一个 `a.json`。 这里在写入前统一检查，避免后写入的文件静默覆盖前一个。
 *
 * @param fileList 源文件相对路径列表
 * @param extension 目标文件扩展名
 * @param format 目标格式名称，仅用于错误信息
 * @throws {Error} 当两个源文件映射到同一目标路径时抛出
 */
const assertUniqueOutputPaths = (
  fileList: readonly string[],
  extension: ".json" | ".md",
  format: string,
): void => {
  const targetSources = new Map<string, string>();

  fileList.forEach((filePath) => {
    const targetRelativePath = getOutputRelativePath(filePath, extension);
    const existingSource = targetSources.get(targetRelativePath);

    if (existingSource) {
      throw new Error(
        `YAML 转 ${format} 输出路径冲突: ${existingSource} 与 ${filePath} 都映射到 ${targetRelativePath}`,
      );
    }

    targetSources.set(targetRelativePath, filePath);
  });
};

/**
 * 检查源文件夹下的所有 YAML 文件
 *
 * @param sourceFolder 源文件夹
 * @param checker 检查函数，接收解析后的数据与文件路径
 * @internal
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const checkYamlFiles = <T = unknown>(
  sourceFolder: string,
  checker: (data: T, filePath: string) => void,
): void => {
  const fileList = getFileList(sourceFolder, YAML_EXTENSIONS);

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

    checker(json, relative("./", stripYamlExtension(filePath)));
  });
};

/**
 * 将源文件夹下的所有 YAML 文件转换为 JSON 文件
 *
 * 本次实际写出的文件会记入目标文件夹的生成清单，下一次运行据此清理源文件已删除的旧输出。 空 YAML 与转换函数返回 `null`/`undefined`
 * 的文件会被跳过且不写入清单：如果该文件上次生成过输出， 下一次运行会把它按陈旧输出删除（旧实现会永久保留）。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹，默认为源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值；返回 `null`/`undefined` 时跳过该文件
 * @param processFunction 内容处理函数，在解析前对 YAML 内容进行预处理
 * @internal
 */
export const convertYamlFilesToJson = <T = unknown, Value = T>(
  sourceFolder: string,
  targetFolder = sourceFolder,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
  processFunction?: (content: string, filePath: string) => string,
): void => {
  const fileList = getFileList(sourceFolder, YAML_EXTENSIONS);
  assertUniqueOutputPaths(fileList, ".json", "JSON");
  const errors: Error[] = [];
  const generatedFiles = new Set<string>();

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, getOutputRelativePath(filePath, ".json"));
    const targetFolderPath = dirname(targetFilename);
    const yamlRelativePath = relative("./", stripYamlExtension(filePath));

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
        generatedFiles.add(relative(resolve(targetFolder), targetFilename));
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

  syncGeneratedOutputs(sourceFolder, targetFolder, ".json", generatedFiles);
};

/**
 * 将源文件夹下的所有 YAML 文件转换为 Markdown 文件
 *
 * 与 `convertYamlFilesToJson` 不同，本函数不把转换函数返回的 `null`/`undefined` 视为“跳过”： 转换函数被声明为返回
 * `string`，当前消费者都返回 Markdown 文本；若运行时返回 `null`/`undefined`， 写入会失败并计入聚合错误，而不是静默跳过该文件。
 *
 * 空 YAML 文件仍会被跳过且不写入生成清单；如果该文件上次生成过 Markdown，下一次运行会把它按陈旧输出删除。
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回 Markdown 内容
 * @param targetFolder 目标文件夹，默认为源文件夹
 * @internal
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const convertYamlFilesToMarkdown = <T = unknown>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => string,
  targetFolder = sourceFolder,
): void => {
  const fileList = getFileList(sourceFolder, YAML_EXTENSIONS);
  assertUniqueOutputPaths(fileList, ".md", "Markdown");
  const errors: Error[] = [];
  const generatedFiles = new Set<string>();

  fileList.forEach((filePath) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const targetFilename = resolve(targetFolder, getOutputRelativePath(filePath, ".md"));
    const targetFolderPath = dirname(targetFilename);

    try {
      const content = readFileSync(sourceFilename, { encoding: "utf-8" });
      const parsed = parseYaml<T>(content, sourceFilename);

      if (parsed === void 0) {
        console.warn(`空 YAML 文件已跳过: ${sourceFilename}`);
        return;
      }

      const result = convertFunction(parsed, relative("./", stripYamlExtension(filePath)));

      if (!existsSync(targetFolderPath)) mkdirSync(targetFolderPath, { recursive: true });

      writeFileAtomically(targetFilename, result);
      generatedFiles.add(relative(resolve(targetFolder), targetFilename));
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

  syncGeneratedOutputs(sourceFolder, targetFolder, ".md", generatedFiles);
};

/** @internal */
export interface YamlInfo<Value = unknown> {
  type: "file";
  filename: string;
  value: Value;
}

/** @internal */
export interface YamlDirInfo<Value = unknown> {
  type: "dir";
  dirname: string;
  content: YamlMapItem<Value>[];
}

/** @internal */
export type YamlMapItem<Value> = YamlInfo<Value> | YamlDirInfo<Value>;

/**
 * 获取源文件夹下的 YAML 文件映射
 *
 * 与其它 YAML 辅助函数一致，空文档（空文件、纯注释、仅文档标记/指令）会被跳过并打印中文告警，而不是抛错中断整个映射；空目录仍会保留。
 *
 * @param sourceFolder 源文件夹
 * @param convertFunction 转换函数，接收解析后的数据与文件路径，返回转换后的值
 * @returns YAML 映射列表
 * @internal
 */
export const getYamlMap = <T = unknown, Value = T>(
  sourceFolder: string,
  convertFunction: (data: T, filePath: string) => Value = (data): Value => data as unknown as Value,
): YamlMapItem<Value>[] => {
  const fileMap = getFileMap(sourceFolder, YAML_EXTENSIONS);

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
        value: convertFunction(parsed, stripYamlExtension(filename)),
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
