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

/**
 * 生成知识库索引（L0 文档索引）
 *
 * 输出 `distFolder/index.json`（或 `index.yaml`），每条记录为： `{ path, title, summary, keywords, campus }`
 *
 * 空字段（summary/keywords/campus）自动省略，不输出空字符串或空数组。
 *
 * `path` 与 `.knowledge` 下生成的 Markdown 文件路径对应（不含扩展名）， 供 AI 读取【标题 + summary + keywords +
 * campus】判断学生问题对应哪个文档， 再调用工具按 path 取全文。
 *
 * @param sourceFolder 源文件夹
 * @param distFolder 输出文件夹
 * @param format 输出格式，`json`（默认）或 `yaml`
 */
export const generateKnowledgeIndex = (
  sourceFolder: string,
  distFolder: string,
  format: "json" | "yaml" = "json",
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
      const item: Record<string, unknown> = { path, title: data.title };

      if (data.summary) item.summary = data.summary;
      if (data.keywords?.length) item.keywords = data.keywords;
      if (data.campus) item.campus = data.campus;

      return item;
    })
    .filter((item): item is Exclude<typeof item, null> => item != null);

  const targetFilename =
    format === "yaml" ? resolve(distFolder, "index.yaml") : resolve(distFolder, "index.json");

  const output =
    format === "yaml"
      ? // flowLevel: 1 → 每条记录一行（keywords 内联数组），最紧凑且自动处理转义
        dump(index, { indent: 2, lineWidth: -1, noRefs: true, flowLevel: 1 })
      : JSON.stringify(index, null, 2);

  writeFileSync(targetFilename, output, { encoding: "utf-8" });
};
