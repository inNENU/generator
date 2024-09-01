import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getFileList } from "./getFileList.js";

/**
 * Extract Latin words from content
 */
const getLatinWords = (content: string): RegExpMatchArray | null =>
  // \u00C0-\u024F are Latin Supplement letters, maybe used in language like french
  // \u0400-\u04FF are Cyrillic letters, used in russian
  content.match(/[\w\d\s,.\u00C0-\u024F\u0400-\u04FF]+/giu);

/**
 * Extract Chinese Characters from content
 */
const getChinese = (content: string): RegExpMatchArray | null =>
  content.match(/[\u4E00-\u9FD5]/gu);

/**
 * Get word number of given string
 */
export const getWordNumber = (content: string): number =>
  (getLatinWords(content)?.reduce<number>(
    (accumulator, word) =>
      accumulator + (word.trim() === "" ? 0 : word.trim().split(/\s+/u).length),
    0,
  ) ?? 0) + (getChinese(content)?.length ?? 0);

export const getJSONValue = (content: unknown): string => {
  if (typeof content === "number") return content.toString();
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (Array.isArray(content)) return content.map(getJSONValue).join(" ");
    else if (content) {
      let result = "";

      for (const key in content)
        result += ` ${getJSONValue((content as Record<string, unknown>)[key])}`;

      return result;
    }
  }

  return "";
};

export const getJSONWordCount = (path: string): number => {
  let words = 0;

  getFileList(path, ".json").forEach((filePath) => {
    const pageContent = JSON.parse(
      readFileSync(resolve(path, filePath), {
        encoding: "utf-8",
      }),
    ) as unknown;

    const content = getJSONValue(pageContent);

    words += getWordNumber(content);
  });

  return words;
};
