import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dump, JSON_SCHEMA, load } from "js-yaml";
import { resolve, relative, dirname } from "upath";

import { getFileList } from "./helpers/index.js";
import { getPageText } from "./page/text.js";
import type { PageConfig } from "./typings.js";

/**
 * 生成知识库内容，将源文件夹下的 YAML 页面转换为 Markdown 文本
 *
 * @param sourceFolder 源文件夹
 * @param distFolder 输出文件夹
 */
export const generateKnowledgeContent = (sourceFolder: string, distFolder: string): void => {
  if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const filePathRelative = relative("./", filePath.replace(/\.yml$/u, ""));
    const sourceFilename = resolve(sourceFolder, filePath);

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const data = load(content, { schema: JSON_SCHEMA }) as PageConfig;

    if (data.aiIgnore) return;

    const text = getPageText(data, filePathRelative);

    const targetFilename = resolve(
      distFolder,
      filePath.replace(/\.yml$/u, ".md").replace(/(?<sep>\/|^)index.md$/u, "$<sep>README.md"),
    );
    const targetDirname = dirname(targetFilename);

    if (!existsSync(targetDirname)) mkdirSync(targetDirname, { recursive: true });

    writeFileSync(targetFilename, text, { encoding: "utf-8" });
  });
};

export interface KnowledgeIndexItem {
  /** 页面路径（不含扩展名，与 Markdown 文件路径对应） */
  path: string;
  /** 页面标题 */
  title: string;
  /** 页面摘要 */
  summary?: string;
  /** 页面关键词 */
  keywords?: string[];
  /** 所属校区 */
  campus?: string;
  /** AI 索引优先级（缺省=high） */
  priority?: "high" | "low";
}

const renderLoraItem = ({ path, title, summary, keywords, campus }: KnowledgeIndexItem): string => {
  const lines = [path];

  // 纯文本格式：有 summary 时 summary 取代 title 行，无 summary 才输出 title 行；换行压缩为单行
  if (summary) lines.push(summary.trim().replaceAll(/\n+/gu, " "));
  else lines.push(title);
  if (keywords?.length) lines.push(`keywords: [${keywords.join(", ")}]`);
  if (campus) lines.push(`campus: ${campus}`);

  return lines.join("\n");
};

const renderLoraIndex = (index: KnowledgeIndexItem[]): string => {
  // 高优先级在前，低优先级在后（低优先级块用标记行分隔，提示 AI 次要参考）
  const high = index
    .filter((item) => item.priority !== "low")
    .map((item) => renderLoraItem(item))
    .join("\n\n");
  const low = index
    .filter((item) => item.priority === "low")
    .map((item) => renderLoraItem(item))
    .join("\n\n");

  return `${high}${low ? `\n\n# 低优先级（次要参考）\n\n${low}` : ""}\n`;
};

/**
 * 生成知识库索引（L0 文档索引）
 *
 * - `json`（默认）：输出 `distFolder/index.json`，每条记录 `{ path, title, summary, keywords, campus }`
 * - `yaml`：输出 `distFolder/index.yaml`，每条记录一行，自动处理转义
 * - `lora`：输出 `distFolder/index.lora`，最紧凑：首行 path、次行 title，summary 直接在 title 下一行裸写（无前缀）， keywords /
 *   campus 仅在存在时以 `keywords:` / `campus:` 前缀附加，记录间空行分隔，适合直接注入 LLM 上下文
 *
 * Lora 的 title 行规则：页面有 summary 时，summary **取代 title**（不再单独输出 title 行）。无 summary 的页面才输出 title 行。
 *
 * 空字段（summary/keywords/campus）自动省略，不输出空字符串或空数组。
 *
 * `path` 与 `.knowledge` 下生成的 Markdown 文件路径对应（不含扩展名）， 供 AI 读取【标题 + summary + keywords +
 * campus】判断学生问题对应哪个文档， 再调用工具按 path 取全文。
 *
 * @param sourceFolder 源文件夹
 * @param distFolder 输出文件夹
 * @param format 输出格式，`json`（默认）、`yaml` 或 `lora`
 */
export const generateKnowledgeIndex = (
  sourceFolder: string,
  distFolder: string,
  format: "json" | "yaml" | "lora" = "json",
): void => {
  if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

  const fileList = getFileList(sourceFolder, "yml");

  const index = fileList
    .map((filePath) => {
      const sourceFilename = resolve(sourceFolder, filePath);

      const content = readFileSync(sourceFilename, { encoding: "utf-8" });

      const data = load(content, { schema: JSON_SCHEMA }) as PageConfig;

      if (data.aiIgnore) return null;

      // 与 generateKnowledgeContent 的 targetFilename 路径保持一致（不含 .md）
      const path = filePath.replace(/\.yml$/u, "").replace(/(?<sep>\/|^)index$/u, "$<sep>README");

      // 跳过空字段
      const item: KnowledgeIndexItem = { path, title: data.title };

      if (data.summary) item.summary = data.summary;
      if (data.keywords?.length) item.keywords = data.keywords;
      if (data.campus) item.campus = data.campus;
      if (data.aiPriority === "low") item.priority = "low";

      return item;
    })
    .filter((item): item is KnowledgeIndexItem => item != null);

  const targetFilename = resolve(
    distFolder,
    format === "yaml" ? "index.yaml" : format === "lora" ? "index.lora" : "index.json",
  );

  const output =
    format === "lora"
      ? renderLoraIndex(index)
      : format === "yaml"
        ? // flowLevel: 1 → 每条记录一行（keywords 内联数组），最紧凑且自动处理转义
          dump(index, { indent: 2, lineWidth: -1, noRefs: true, flowLevel: 1 })
        : JSON.stringify(index, null, 2);

  writeFileSync(targetFilename, output, { encoding: "utf-8" });
};
