import { existsSync, mkdirSync, readFileSync } from "node:fs";

import { dump } from "js-yaml";
import { resolve, relative, dirname } from "upath";

import { withoutAssetFileCheck } from "./helpers/assetCheck.js";
import { writeFileAtomically } from "./helpers/generation-manifest.js";
import { formatZodError, getFileList } from "./helpers/index.js";
import { parseYaml } from "./helpers/yaml.js";
import { stripYamlExtension, YAML_EXTENSIONS } from "./helpers/yamlPath.js";
import { pageConfigSchema } from "./page/schema.js";
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
 * 读取并校验页面配置
 *
 * 解析失败或不符合 `pageConfigSchema` 时输出带文件路径的错误并返回 `null`，避免单页问题中断整批转换。 解析统一走 `parseYaml`，与其它 YAML
 * 转换路径一致地应用别名数量（`maxAliases`）与展开节点上限，并把解析异常包装成带文件路径的错误； 空文件、纯注释或仅包含文档标记/指令的页面没有页面配置，按非法页面跳过。
 *
 * @param sourceFilename 页面 YAML 文件路径
 * @param displayPath 报错中展示的相对路径
 * @returns 校验后的页面配置，失败时返回 null
 */
const loadPageConfig = (sourceFilename: string, displayPath: string): PageConfig | null => {
  try {
    const content = readFileSync(sourceFilename, { encoding: "utf-8" });
    const value = parseYaml(content, sourceFilename);

    if (value === void 0) {
      console.error(`${displayPath} 页面配置为空（空文件、仅注释或仅文档标记），已跳过`);

      return null;
    }

    const parsed = pageConfigSchema.safeParse(value);

    if (!parsed.success) {
      console.error(`${displayPath} 页面配置校验失败:\n${formatZodError(parsed.error)}`);

      return null;
    }

    return parsed.data;
  } catch (err) {
    console.error(`${displayPath} 读取或解析失败:`, err);

    return null;
  }
};

/**
 * 生成知识库内容，将源文件夹下的 YAML 页面转换为 Markdown 文本
 *
 * 每个 Markdown 文件都通过 `writeFileAtomically` 写出（先写临时文件再 rename），避免中途失败留下半截文件。
 *
 * 关于陈旧输出：本函数不清理 `distFolder` 中源文件已删除的旧产物。真实消费者（innenu-resource）在生成前会整体删除输出目录
 * （`deleteSync("./.resource/**")`），陈旧文件不会跨运行堆积；而现有 generation-manifest 的清理 API 按站点约定把 `index.yml`
 * 映射为 `README.md`，且只支持 `.json` / `.md` 两种扩展名，与知识库的 `index.md` 及 `index.lora|yaml|json`
 * 输出约定不一致，直接复用会误记/误删路径，并会在 AI 消费目录里额外留下清单文件。因此在 API 扩展出可定制的输出路径映射之前不做清理，避免引入破坏性行为。
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
  // 知识库只消费页面文本，产物不包含资源文件本身；稀疏检出（CI 不下载 img/file）下资源必然缺失，
  // 因此生成期间关闭资源文件存在性校验，保留页面结构 / 字段 / 语义校验。
  withoutAssetFileCheck(() => {
    if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

    const fileList = getFileList(sourceFolder, YAML_EXTENSIONS);

    fileList.forEach((filePath) => {
      const filePathRelative = relative("./", stripYamlExtension(filePath));
      const sourceFilename = resolve(sourceFolder, filePath);
      const data = loadPageConfig(sourceFilename, filePath);

      if (!data || data.aiIgnore) return;

      const targetFilename = resolve(distFolder, `${stripYamlExtension(filePath)}.md`);

      try {
        const text = getPageText(data, filePathRelative, options);

        const targetDirname = dirname(targetFilename);

        if (!existsSync(targetDirname)) mkdirSync(targetDirname, { recursive: true });

        writeFileAtomically(targetFilename, text);
      } catch (err) {
        console.error(`${filePathRelative} 生成知识库 Markdown 失败:`, err);
      }
    });
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
 * 索引文件通过 `writeFileAtomically` 写出（先写临时文件再 rename），避免中途失败留下半截文件。
 *
 * 与 `generateKnowledgeContent` 相同，本函数不清理 `distFolder` 里的陈旧输出：消费者会在生成前整体删除输出目录，而现有
 * generation-manifest 清理 API 的路径映射与扩展名约定也不适用于知识库索引（详见 `generateKnowledgeContent` 的说明）。
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
  const resolveSorter = (): KnowledgeIndexSorter | null =>
    sorter ? (typeof sorter === "function" ? sorter : createKnowledgeSorter(sorter)) : null;

  // 与 generateKnowledgeContent 一致：索引只需要页面字段，稀疏检出下不校验资源文件是否存在。
  withoutAssetFileCheck(() => {
    if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

    const fileList = getFileList(sourceFolder, YAML_EXTENSIONS);

    const index = fileList
      .map((filePath) => {
        const sourceFilename = resolve(sourceFolder, filePath);
        const data = loadPageConfig(sourceFilename, filePath);

        if (!data || data.aiIgnore) return null;

        const path = stripYamlExtension(filePath);

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

    writeFileAtomically(targetFilename, output);
  });
};
