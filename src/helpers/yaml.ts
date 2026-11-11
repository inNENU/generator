// oxlint-disable max-lines -- YAML schema、解析、序列化与文件转换逻辑集中在同一模块
import { existsSync, mkdirSync, readFileSync } from "node:fs";

import { dirname, join, relative, resolve } from "upath";
import type { CollectionTag, Document, ScalarTag, Tags } from "yaml";
import {
  Composer,
  CST,
  Parser,
  Schema,
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  parseAllDocuments,
  stringify as stringifyYaml,
} from "yaml";

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

/** 单个 YAML 文档允许的最大嵌套层级，与旧版 js-yaml 的 maxDepth 对齐 */
const MAX_YAML_DEPTH = 100;

/**
 * 校验解析结果可以安全序列化
 *
 * 别名会被解析为共享引用，正常的重复引用可以复用；但自引用会形成环（`JSON.stringify` 会抛错）， 嵌套别名还可能指数级展开（俗称 YAML
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

/** JSON schema 允许的隐式整数写法（十进制，无前导零） */
const jsonImplicitIntegerPattern = /^-?(?:0|[1-9][0-9]*)$/u;

/** JSON schema 允许的显式 `!!int` 写法（含 1.2 的 0b/0o/0x） */
const jsonExplicitIntegerPattern =
  /^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$/u;

/**
 * 解析显式 `!!int` 的整数原文
 *
 * @param source 整数原文
 * @returns 解析后的整数
 */
const parseIntegerSource = (source: string): number => {
  let value = source;
  let sign = 1;

  if (value.startsWith("-") || value.startsWith("+")) {
    if (value.startsWith("-")) sign = -1;
    value = value.slice(1);
  }

  if (value.startsWith("0b")) return sign * Number.parseInt(value.slice(2), 2);
  if (value.startsWith("0o")) return sign * Number.parseInt(value.slice(2), 8);
  if (value.startsWith("0x")) return sign * Number.parseInt(value.slice(2), 16);

  return sign * Math.trunc(Number(value));
};

/**
 * 判断数值是否可安全表示
 *
 * 超出 `number` 表示范围的整数/浮点会变成 `Infinity`，序列化成 JSON 时又变成 `null`；旧版 js-yaml 会把隐式溢出的数字保留为字符串，并拒绝显式
 * `!!int`/`!!float` 的溢出值。这里用有限性检查对齐该行为。
 *
 * @param value 待检查的数值
 * @returns 是否为有限数值
 */
const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

/**
 * 创建带大整数告警的整数标签
 *
 * 保留 `yaml` JSON schema 的整数语义（隐式只接受十进制 JSON 整数，显式 `!!int` 支持 1.2 的 0b/0o/0x）， 只额外在整数超出 JavaScript
 * 安全整数范围时打印告警，避免静默丢失精度。
 *
 * @param filePath 文件路径，仅用于告警信息
 * @returns 用于本次解析的整数标签（显式标签在前，隐式标签在后）
 */
const createIntegerTags = (filePath: string): ScalarTag[] => [
  {
    tag: "tag:yaml.org,2002:int",
    default: false,
    resolve: (source: string) => {
      if (!jsonExplicitIntegerPattern.test(source))
        throw new Error("cannot resolve a node with !<tag:yaml.org,2002:int> explicit tag");

      const value = parseIntegerSource(source);

      if (!isFiniteNumber(value))
        throw new Error("cannot resolve a node with !<tag:yaml.org,2002:int> explicit tag");

      warnIfUnsafeInteger(source, filePath);

      return value;
    },
  },
  {
    tag: "tag:yaml.org,2002:int",
    default: true,
    test: jsonImplicitIntegerPattern,
    resolve: (source: string) => {
      const value = Math.trunc(Number(source));

      // 隐式超范围整数按字符串保留（与旧版 js-yaml 一致），不打印精度告警
      if (!isFiniteNumber(value)) return source;

      warnIfUnsafeInteger(source, filePath);

      return value;
    },
  },
];

/** JSON schema 允许的隐式浮点数写法（与 js-yaml 的 JSON schema 对齐） */
const jsonImplicitFloatPattern = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/u;

/** JSON schema 允许的显式 `!!float` 写法（与 js-yaml 的 JSON schema 对齐） */
const jsonExplicitFloatPattern =
  /^(?:[-+]?[0-9]+(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/u;

/**
 * 解析显式 `!!float` 的浮点原文
 *
 * @param source 浮点原文
 * @returns 解析后的浮点数（`.inf`/`.nan` 与旧版 js-yaml 一样解析为 Infinity/NaN）
 */
const parseExplicitFloatSource = (source: string): number => {
  let value = source.toLowerCase();
  const sign = value.startsWith("-") ? -1 : 1;

  if (value.startsWith("-") || value.startsWith("+")) value = value.slice(1);
  if (value === ".inf") return sign * Number.POSITIVE_INFINITY;
  if (value === ".nan") return Number.NaN;

  return sign * Number(value);
};

/**
 * 创建与 js-yaml JSON schema 对齐的布尔、空值与浮点标签
 *
 * `yaml` 内置的 JSON schema 在遇到显式标签的非法值/非法节点种类时只会产生 warning 并降级，而旧版 js-yaml 会直接拒绝；这里用显式标签补回严格校验，
 * 并保持隐式写法（`true`/`false`/`null`/JSON 浮点）与旧行为一致。
 *
 * @returns 用于本次解析的标量标签（每个标签均为显式在前、隐式在后）
 */
const createJsonScalarTags = (): ScalarTag[] => [
  {
    tag: "tag:yaml.org,2002:bool",
    default: false,
    resolve: (source: string) => {
      if (source === "true") return true;
      if (source === "false") return false;

      throw new Error("cannot resolve a node with !<tag:yaml.org,2002:bool> explicit tag");
    },
  },
  {
    tag: "tag:yaml.org,2002:bool",
    default: true,
    test: /^(?:true|false)$/u,
    resolve: (source: string) => source === "true",
  },
  {
    tag: "tag:yaml.org,2002:null",
    default: false,
    resolve: (source: string) => {
      if (source === "" || source === "null") return null;

      throw new Error("cannot resolve a node with !<tag:yaml.org,2002:null> explicit tag");
    },
  },
  {
    tag: "tag:yaml.org,2002:null",
    default: true,
    test: /^null$/u,
    resolve: () => null,
  },
  {
    tag: "tag:yaml.org,2002:float",
    default: false,
    resolve: (source: string) => {
      if (!jsonExplicitFloatPattern.test(source))
        throw new Error("cannot resolve a node with !<tag:yaml.org,2002:float> explicit tag");

      const value = parseExplicitFloatSource(source);
      // `.inf`/`.nan` 是显式允许的特殊值；其余溢出（如 `1e999`）旧实现会拒绝
      const normalizedSource = source.replace(/^[-+]/u, "").toLowerCase();

      if (!isFiniteNumber(value) && normalizedSource !== ".inf" && normalizedSource !== ".nan")
        throw new Error("cannot resolve a node with !<tag:yaml.org,2002:float> explicit tag");

      return value;
    },
  },
  {
    tag: "tag:yaml.org,2002:float",
    default: true,
    test: jsonImplicitFloatPattern,
    resolve: (source: string) => {
      const value = Number(source);

      // 隐式超范围浮点按字符串保留（与旧版 js-yaml 一致）
      return isFiniteNumber(value) ? value : source;
    },
  },
];

/**
 * 创建带大整数告警的 YAML schema
 *
 * 基于 `yaml` 内置的 JSON schema，但去掉“无法解析的 plain scalar 直接报错”的兜底标签，让未匹配 JSON 标量的纯量按字符串处理，与旧版 js-yaml
 * JSON schema 行为一致。
 *
 * @param filePath 文件路径，仅用于告警信息
 * @returns 用于本次解析的 schema
 */
const createYamlSchema = (filePath: string): Schema =>
  new Schema({
    schema: "json",
    customTags: (tags: Tags): Tags =>
      (tags as (CollectionTag | ScalarTag)[])
        .filter((tag) => tag.tag !== "")
        .flatMap((tag) => {
          if (tag.tag === "tag:yaml.org,2002:int") return createIntegerTags(filePath);
          if (
            tag.tag === "tag:yaml.org,2002:bool" ||
            tag.tag === "tag:yaml.org,2002:null" ||
            tag.tag === "tag:yaml.org,2002:float"
          )
            return createJsonScalarTags().filter((replacement) => replacement.tag === tag.tag);

          return [tag];
        }),
  });

/**
 * 匹配位于第 0 列的文档标记行（`---`、`...`）
 *
 * 文档标记后只允许空白或注释；这里按单行匹配，调用前已统一换行符并去掉 `\r`，所以 CRLF/CR 文件不会被漏判。
 */
const yamlDocumentMarkerPattern = /^(?:---|\.\.\.)(?:[ \t]+(?:#.*)?)?$/u;

/**
 * 匹配流起始处带缩进的 `---`
 *
 * 旧版 js-yaml 解析器会把文件首行缩进的 `---`（可带行尾注释）当作文档开始标记，而不是普通标量；同样的内容出现在第二行及以后才是标量，因此只在首行应用。`...` 没有这个特例。
 */
const yamlIndentedStartMarkerPattern = /^[ \t]+---(?:[ \t]+(?:#.*)?)?$/u;

/**
 * 匹配 YAML 指令行
 *
 * 只承认规范定义的 `%YAML`/`%TAG`；其它第 0 列的 `%` 行不是可跳过的内容，交给解析器判定（可能是非法指令）。
 */
const yamlDirectivePattern = /^%(?:YAML|TAG)\b/u;

/**
 * 判断 YAML 内容是否包含实际文档
 *
 * 空行、注释、文档标记（`---`/`...`）与指令（`%YAML`/`%TAG`）都不构成文档内容。文件开头的 BOM 会先剥离，CRLF/CR 行尾按换行拆分，因此行尾不会影响判断。
 * 文档标记与指令按规范必须位于第 0 列，缩进的 `...` 属于普通标量；但旧版 js-yaml 会把流起始处缩进的 `---` 当作文档开始标记，这里仅在首行与之保持一致。缩进的 `%foo`
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
 * 把流起始处缩进的文档标记移到第 0 列
 *
 * 旧版 js-yaml 会把首行缩进的 `---` 当作文档开始标记，而 `yaml` 会把它当作普通标量。这里仅在首行命中缩进标记时把该行前导空白去掉，保持旧版语义。
 *
 * @param content YAML 内容
 * @returns 归一化后的 YAML 内容
 */
const normalizeStreamStartMarker = (content: string): string => {
  const source = content.replace(/^\uFEFF/u, "");
  const lines = source.split(/\r\n?|\n/u);

  // 旧版 js-yaml 把首行缩进的 `---`（可带内容/注释）当作文档开始标记；yaml 则当作普通标量
  if (lines.length > 0 && /^[ \t]+---(?:[ \t].*)?$/u.test(lines[0])) {
    lines[0] = lines[0].trimStart();

    return lines.join("\n");
  }

  return source;
};

/** JSON schema 允许的标量标签（与 js-yaml 的 `JSON_SCHEMA` 对齐） */
const JSON_SCHEMA_SCALAR_TAGS = new Set([
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:float",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:str",
]);

/**
 * 解析 mapping key 上的别名
 *
 * 旧版 js-yaml 支持标量别名作为 key，但会拒绝指向 map/seq 的别名 key（complex key）。`yaml` 默认把别名 key 保留为 Alias 节点，这里先解析成
 * 目标节点，让标签、null key 与重复 key 检查都能看到真实值。
 *
 * @param key Key 节点
 * @param document 所属文档
 * @returns 解析后的节点（非别名原样返回）
 */
const resolveKeyNode = (key: unknown, document: Document): unknown => {
  if (!isAlias(key)) return key;

  const resolved = key.resolve(document);

  if (!resolved) throw new Error("unresolved alias in mapping key");

  return resolved;
};

/**
 * 校验文档中不存在 JSON schema 之外的标签
 *
 * `yaml` 在 `schema: "json"` 下仍会解析 `!!timestamp`、`!!binary`、`!!set`、`!!omap` 等内置标签，而旧版 js-yaml 的
 * `JSON_SCHEMA` 会以 “unknown tag” 拒绝；这里递归检查 AST 节点标签，保持旧行为的严格度。
 *
 * @param node 待检查的节点
 * @param document 所属文档，用于解析别名 key
 */
const assertJsonSchemaTags = (node: unknown, document: Document): void => {
  if (isAlias(node)) return;

  if (isMap(node)) {
    if (node.tag && node.tag !== "tag:yaml.org,2002:map")
      throw new Error(`unknown mapping tag !<${node.tag}>`);

    for (const pair of node.items) {
      // 旧版 js-yaml 的 object-based map 只支持标量 key；别名 key 解析后按真实节点判断
      const keyNode = resolveKeyNode(pair.key, document);

      if (!isScalar(keyNode)) throw new Error("object-based map does not support complex keys");

      if (keyNode.tag && !JSON_SCHEMA_SCALAR_TAGS.has(keyNode.tag))
        throw new Error(`unknown scalar tag !<${keyNode.tag}>`);

      assertJsonSchemaTags(pair.value, document);
    }

    return;
  }

  if (isSeq(node)) {
    if (node.tag && node.tag !== "tag:yaml.org,2002:seq")
      throw new Error(`unknown sequence tag !<${node.tag}>`);

    for (const item of node.items) assertJsonSchemaTags(item, document);

    return;
  }

  // 标量节点只允许标量标签；`!!map foo`/`!!seq foo`/空 `!!map` 之类必须拒绝，不能降级成字符串
  if (isScalar(node) && node.tag && !JSON_SCHEMA_SCALAR_TAGS.has(node.tag))
    throw new Error(`unknown scalar tag !<${node.tag}>`);
};

/**
 * 校验映射中不存在重复 key
 *
 * 旧版 js-yaml 会拒绝重复 key（`1` 与 `"1"`、`true` 与 `"true"` 视为同一个 key）；`yaml` 的同类检查是 O(n²) 的，这里关闭后按字符串化
 * key 做线性检查，保持旧语义。
 *
 * @param node 待检查的节点
 * @param document 所属文档，用于解析别名 key
 */
const assertUniqueMapKeys = (node: unknown, document: Document): void => {
  if (isAlias(node)) return;

  if (isMap(node)) {
    const keys = new Set<string>();

    for (const pair of node.items) {
      const keyNode = resolveKeyNode(pair.key, document);

      if (!isScalar(keyNode)) throw new Error("object-based map does not support complex keys");

      const key = String(keyNode.value);

      if (keys.has(key)) throw new Error("duplicated mapping key");

      keys.add(key);
      assertUniqueMapKeys(pair.value, document);
    }

    return;
  }

  if (isSeq(node)) for (const item of node.items) assertUniqueMapKeys(item, document);
};

/**
 * 统计 AST 中的别名节点数量
 *
 * `yaml` 的 `maxAliasCount` 按「单个 anchor 的引用次数 × 展开规模」计数，与旧版 js-yaml 的「别名节点总数」口径不同；这里先按旧口径统计一次， 保证超过
 * 100 个别名节点的输入仍会被拒绝。
 *
 * @param node 待统计的节点
 * @returns 别名节点总数
 */
const countAliasNodes = (node: unknown): number => {
  if (isAlias(node)) return 1;

  if (isMap(node)) {
    let count = 0;

    for (const pair of node.items) count += countAliasNodes(pair.key) + countAliasNodes(pair.value);

    return count;
  }

  if (isSeq(node)) {
    let count = 0;

    for (const item of node.items) count += countAliasNodes(item);

    return count;
  }

  return 0;
};

/**
 * 校验文档字面集合的嵌套层级
 *
 * 与 js-yaml 的 `maxDepth` 对齐：按源码里的 map/seq 嵌套计数，不跟随 alias（alias 链不算深度，另由别名数量上限约束）。 在
 * `toJS`/对象转换前用迭代遍历完成，避免极深输入在递归转换时爆栈。
 *
 * @param node 文档根节点
 * @param filePath 文件路径（用于错误消息）
 */
const assertYamlNestingDepth = (node: unknown, filePath: string): void => {
  const stack: { node: unknown; depth: number }[] = [{ node, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) break;

    const { node: value, depth } = current;

    if (!isMap(value) && !isSeq(value)) continue;

    const nextDepth = depth + 1;

    if (nextDepth >= MAX_YAML_DEPTH)
      throw new Error(`YAML 文档嵌套层级超过上限（${MAX_YAML_DEPTH} 层，文件: ${filePath}）`);

    if (isMap(value))
      for (const pair of value.items) stack.push({ node: pair.value, depth: nextDepth });
    else for (const item of value.items) stack.push({ node: item, depth: nextDepth });
  }
};

/**
 * 把 `yaml` 的 `mapAsMap` 结果转换为普通对象
 *
 * 旧版 js-yaml 把 mapping 转成普通对象，并把 `null` 键序列化为 `"null"`；`yaml` 默认的 `toJS` 会把 null 键变成空串。这里保留 null
 * 的原始值， 再按旧规则字符串化。使用 memo 保留别名共享引用与循环引用，供后续安全检查识别。
 *
 * @param value `toJS({ mapAsMap: true })` 的结果
 * @returns 普通对象/数组结构
 */
const convertYamlValue = (value: unknown): unknown => {
  const memo = new Map<object, unknown>();

  const convert = (node: unknown): unknown => {
    if (node == null || typeof node !== "object") return node;

    if (memo.has(node)) return memo.get(node);

    if (node instanceof Map) {
      const result: Record<string, unknown> = {};

      memo.set(node, result);

      for (const [key, item] of node) {
        // 旧版 js-yaml 的 object key 字符串化规则：null → "null"，其余用 String
        Object.defineProperty(result, key == null ? "null" : String(key), {
          configurable: true,
          enumerable: true,
          value: convert(item),
          writable: true,
        });
      }

      return result;
    }

    if (Array.isArray(node)) {
      const result: unknown[] = [];

      memo.set(node, result);
      for (const item of node) result.push(convert(item));

      return result;
    }

    return node;
  };

  return convert(value);
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
    // 与旧版 js-yaml 一致：NUL 字节不是合法 YAML 输入
    if (content.includes("\u0000")) throw new Error("null byte is not allowed in input");
    // 其它原始 C0 控制字符（tab、CR、LF 除外）在旧版 js-yaml 中会被拒绝；这里提前拒绝，避免 yaml 静默接受
    // oxlint-disable-next-line no-control-regex -- 这里就是要拒绝原始控制字符
    if (/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/u.test(content))
      throw new Error("expected valid JSON character");

    // 旧版 js-yaml 把 CRLF/CR 都当换行；统一成 LF 后再解析，避免 CR-only 文件被 yaml 拒绝
    const normalizedContent = content.replaceAll(/\r\n?/gu, "\n");

    let documents;

    try {
      documents = parseAllDocuments(normalizeStreamStartMarker(normalizedContent), {
        logLevel: "silent",
        schema: createYamlSchema(filePath),
        // yaml 默认的重复 key 检查是 O(n²)（大 map 上会退化到秒级）；这里关闭它，改用下方线性检查保持旧语义
        uniqueKeys: false,
      });
    } catch (err) {
      // 极深字面量在 yaml 组合阶段就会递归爆栈；按旧版 js-yaml 的 maxDepth 语义转成中文错误
      if (
        err instanceof RangeError ||
        (err instanceof Error && /Maximum call stack size exceeded/u.test(err.message))
      ) {
        throw new Error(`YAML 文档嵌套层级超过上限（${MAX_YAML_DEPTH} 层，文件: ${filePath}）`, {
          cause: err,
        });
      }

      throw err;
    }

    // 旧版 js-yaml 的 load 只接受单个文档；这里显式拒绝多文档输入，避免静默只取第一个文档
    if (documents.length > 1)
      throw new Error("expected a single document in the stream, but found more");

    const [document] = documents;

    // 只有指令、没有文档内容时 yaml 会返回空文档流；旧版 js-yaml 对此报错
    if (!document) throw new Error("输入不是有效的 YAML 文档");

    if (document.errors.length > 0) {
      const [firstError] = document.errors;

      // 极深字面量在组合阶段会递归爆栈，错误被收进 document.errors；按旧版 maxDepth 语义转成中文错误
      if (/Maximum call stack size exceeded/u.test(firstError.message)) {
        throw new Error(`YAML 文档嵌套层级超过上限（${MAX_YAML_DEPTH} 层，文件: ${filePath}）`, {
          cause: firstError,
        });
      }

      throw firstError;
    }

    assertJsonSchemaTags(document.contents, document);
    assertYamlNestingDepth(document.contents, filePath);
    assertUniqueMapKeys(document.contents, document);

    if (countAliasNodes(document.contents) > MAX_YAML_ALIASES)
      throw new Error(`YAML 别名展开后过大（maxAliases: ${MAX_YAML_ALIASES}），可能存在别名炸弹`);

    // 别名总量已在上方按旧口径检查；这里关闭 yaml 的“单 anchor 引用次数 × 展开规模”检查，
    // 让展开后的节点数量统一由 assertYamlValueSafe 的 10 万节点上限拦截（与旧版 js-yaml 一致）。
    // 用 mapAsMap 保留 null 键的原始值（yaml 默认会把 null 键序列化成空串），再由 convertYamlValue 按旧 js-yaml 规则转成普通对象
    const rawValue = document.toJS({ maxAliasCount: -1, mapAsMap: true }) as unknown;

    const value = convertYamlValue(rawValue) as T;

    assertYamlValueSafe(value, filePath);

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
