import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dump, JSON_SCHEMA, load } from "js-yaml";
import { resolve, relative, dirname } from "upath";

import { getFileList } from "./helpers/index.js";
import { getPageText } from "./page/text.js";
import type { UrlConverter } from "./page/text.js";
import type { PageConfig } from "./typings.js";

export interface KnowledgeContentOptions {
  /**
   * URL 转换器：将页面组件中的链接（如 `notice-detail?url=...`）转换为知识库可读的 `{ miniapp, web }` 两种形式。返回 `null` /
   * `undefined` 时该链接（及其所在条目）被丢弃。
   */
  urlConverter?: UrlConverter;
  /**
   * 渲染模式： - `web`（默认）：纯标准 markdown，由 Dify 等直接渲染，不带自定义容器/标记； - `miniapp`：结构增强 markdown，保留
   * `action`（`::: action` 容器）、`text`/`p` 的 `type`（`::: tip` 等容器）、 `list`/`grid` 项的 `icon`/`path`
   * 特征，便于 AI 还原成小程序组件 JSON。
   */
  mode?: "web" | "miniapp";
}

/**
 * 生成知识库内容，将源文件夹下的 YAML 页面转换为 Markdown 文本
 *
 * @default {}
 * @param sourceFolder 源文件夹
 * @param distFolder 输出文件夹
 * @param options 生成选项
 */
export const generateKnowledgeContent = (
  sourceFolder: string,
  distFolder: string,
  options: KnowledgeContentOptions = {},
): void => {
  if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const filePathRelative = relative("./", filePath.replace(/\.yml$/u, ""));
    const sourceFilename = resolve(sourceFolder, filePath);

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const data = load(content, { schema: JSON_SCHEMA }) as PageConfig;

    if (data.aiIgnore) return;

    const text = getPageText(data, filePathRelative, options);

    const targetFilename = resolve(distFolder, filePath.replace(/\.yml$/u, ".md"));
    const targetDirname = dirname(targetFilename);

    if (!existsSync(targetDirname)) mkdirSync(targetDirname, { recursive: true });

    writeFileSync(targetFilename, text, { encoding: "utf-8" });
  });
};

export interface KnowledgeIndexItem {
  /** 页面路径（不含扩展名，与 Markdown 文件路径对应） */
  path: string;
  /** 页面信息（summary 取代 title，无 summary 时为 title） */
  info: string;
  /** 页面关键词 */
  keywords?: string[];
  /** 所属校区 */
  campus?: string;
  /**
   * AI 索引优先级（数字权重，越大越靠前，负数视为低优先级）
   *
   * @default 0
   */
  priority?: number;
}

/**
 * 知识库索引排序器：比较两个索引项的先后顺序
 *
 * @param a 索引项 a
 * @param b 索引项 b
 * @returns 负数表示 a 在前，正数表示 b 在前，0 表示保持原顺序
 */
export type KnowledgeIndexSorter = (a: KnowledgeIndexItem, b: KnowledgeIndexItem) => number;

/**
 * 根据路径前缀数组创建排序器
 *
 * 对每个索引项，取其 path 能匹配的**最长**路径前缀在数组中的位置进行比较； 未匹配任何前缀的项排在最后（保持原相对顺序）。
 *
 * 例：paths 为 `["intro", "guide", "intro/teacher"]` 时， `intro/history` 匹配 `intro`（靠前）， 而
 * `intro/teacher/xxx` 匹配更长的 `intro/teacher`（排到 `guide` 之后）。
 *
 * @param paths 路径前缀数组，按优先级从高到低排列
 * @returns 排序器
 */
export const createKnowledgeSorter = (paths: string[]): KnowledgeIndexSorter => {
  const getPosition = (path: string): number => {
    let bestIndex = paths.length;
    let bestLength = -1;

    paths.forEach((prefix, index) => {
      if ((path === prefix || path.startsWith(`${prefix}/`)) && prefix.length > bestLength) {
        bestLength = prefix.length;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  return (a, b) => getPosition(a.path) - getPosition(b.path);
};

/**
 * 索引排序：先按优先级（数字越大越靠前），再按自定义排序器（sorter 缺省时保持同优先级项的原顺序）
 *
 * @param items 索引项数组
 * @param sorter 路径排序器（可省略）
 * @returns 排序后的索引项数组
 */
const sortIndex = (
  items: KnowledgeIndexItem[],
  sorter?: KnowledgeIndexSorter | null,
): KnowledgeIndexItem[] =>
  items.toSorted((a, b) => {
    // 优先级：数字越大越靠前（缺省 0）
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);

    if (priorityDiff !== 0) return priorityDiff;

    return sorter ? sorter(a, b) : 0;
  });

const renderLoraItem = ({ path, info, keywords, campus }: KnowledgeIndexItem): string => {
  const lines = [path, info.replaceAll(/\n+/gu, " ")];

  // 纯文本格式：keywords / campus 带前缀区分类型，换行压缩为单行
  if (keywords?.length) lines.push(`keywords: [${keywords.join(", ")}]`);
  if (campus) lines.push(`campus: ${campus}`);

  return lines.join("\n");
};

const renderLoraIndex = (index: KnowledgeIndexItem[]): string => {
  // 高优先级（priority >= 0）在前，低优先级（priority < 0）在后（标记行分隔，提示 AI 次要参考）
  const high = index
    .filter((item) => (item.priority ?? 0) >= 0)
    .map((item) => renderLoraItem(item))
    .join("\n\n");
  const low = index
    .filter((item) => (item.priority ?? 0) < 0)
    .map((item) => renderLoraItem(item))
    .join("\n\n");

  return `${high}${low ? `\n\n# 低优先级（次要参考）\n\n${low}` : ""}\n`;
};

export interface KnowledgeIndexOptions {
  /**
   * 输出格式
   *
   * @default "lora"
   */
  format?: "json" | "yaml" | "lora";
  /** 索引排序器。可传入自定义 `(a, b) => number` 函数，或路径前缀数组（内部用 `createKnowledgeSorter` 转换） */
  sorter?: KnowledgeIndexSorter | string[];
  /**
   * 优先级计算器：基于完整索引项（`path` / `info` / `keywords` / `campus`）与已有的 aiPriority（可能缺省）返回新的优先级。
   *
   * 返回 `null` / `undefined` 时视为 `0`（缺省优先级）。
   */
  priorityGetter?: (item: KnowledgeIndexItem, priority?: number) => number | null | undefined;
}

/**
 * 生成知识库索引（L0 文档索引）
 *
 * - `json`：输出 `distFolder/index.json`，每条记录 `{ path, info, keywords, campus }`
 * - `yaml`：输出 `distFolder/index.yaml`，每条记录一行，自动处理转义
 * - `lora`（默认）：输出 `distFolder/index.lora`，最紧凑：首行 path、次行 info（summary 取代 title）， keywords / campus 仅
 *   在存在时以 `keywords:` / `campus:` 前缀附加，记录间空行分隔，适合直接注入 LLM 上下文
 *
 * 空字段（keywords/campus）自动省略，不输出空字符串或空数组。
 *
 * `path` 与 `.knowledge` 下生成的 Markdown 文件路径对应（不含扩展名）， 供 AI 读取【信息 + keywords + campus】判断学生问题对应哪个文档，
 * 再调用工具按 path 取全文。
 *
 * @default {}
 * @param sourceFolder 源文件夹
 * @param distFolder 输出文件夹
 * @param options 生成选项
 */
export const generateKnowledgeIndex = (
  sourceFolder: string,
  distFolder: string,
  { format = "lora", sorter, priorityGetter }: KnowledgeIndexOptions = {},
): void => {
  if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

  const fileList = getFileList(sourceFolder, "yml");

  const resolveSorter = (): KnowledgeIndexSorter | null =>
    sorter ? (typeof sorter === "function" ? sorter : createKnowledgeSorter(sorter)) : null;

  const index = fileList
    .map((filePath) => {
      const sourceFilename = resolve(sourceFolder, filePath);

      const content = readFileSync(sourceFilename, { encoding: "utf-8" });

      const data = load(content, { schema: JSON_SCHEMA }) as PageConfig;

      if (data.aiIgnore) return null;

      const path = filePath.replace(/\.yml$/u, "");

      const info = (data.summary ?? data.title).trim();

      // 已有优先级（aiPriority，无字段时为 undefined）
      const basePriority = "aiPriority" in data ? data.aiPriority : void 0;

      // 构造完整索引项（path / info / keywords / campus）
      const item: KnowledgeIndexItem = { path, info };

      if (data.keywords?.length) item.keywords = data.keywords;
      if (data.campus) item.campus = data.campus;

      // 有 priorityGetter 时基于完整索引项与已有优先级重新计算（返回 null / undefined 视为 0）
      const priority = priorityGetter
        ? (priorityGetter(item, basePriority) ?? 0)
        : (basePriority ?? 0);

      if (priority !== 0) item.priority = priority;

      return item;
    })
    .filter((item): item is KnowledgeIndexItem => item != null);

  // 统一排序：先按优先级，再按自定义排序器（sorter 缺省为空时不改变顺序）
  const sortedIndex = sortIndex(index, resolveSorter());

  const targetFilename = resolve(
    distFolder,
    format === "yaml" ? "index.yaml" : format === "lora" ? "index.lora" : "index.json",
  );

  const output =
    format === "lora"
      ? renderLoraIndex(sortedIndex)
      : format === "yaml"
        ? // flowLevel: 1 → 每条记录一行（keywords 内联数组），最紧凑且自动处理转义
          dump(sortedIndex, { indent: 2, lineWidth: -1, noRefs: true, flowLevel: 1 })
        : JSON.stringify(sortedIndex, null, 2);

  writeFileSync(targetFilename, output, { encoding: "utf-8" });
};
