import { readFileSync } from "node:fs";
import path from "node:path";

import { getFileList } from "./getFileList.js";

/**
 * 从内容中提取拉丁单词
 *
 * @param content 需要提取拉丁单词的内容
 * @returns 内容中的拉丁单词数组，若没有则返回 null
 */
const getLatinWords = (content: string): RegExpMatchArray | null =>
  // \u00C0-\u024F 是拉丁补充字母，可能用于法语等语言
  // \u0400-\u04FF 是西里尔字母，用于俄语
  content.match(/[\w\d\s,.\u00C0-\u024F\u0400-\u04FF]+/giu);

/**
 * 从内容中提取中文字符
 *
 * @param content 需要提取中文字符的内容
 * @returns 内容中的中文字符数组，若没有则返回 null
 */
const getChinese = (content: string): RegExpMatchArray | null => content.match(/[\u4E00-\u9FD5]/gu);

/**
 * 统计字符串的字数
 *
 * @param content 需要统计字数的内容
 * @returns 内容中的字数，同时统计拉丁单词与中文字符
 */
export const getWordNumber = (content: string): number =>
  (getLatinWords(content)?.reduce(
    (accumulator, word) =>
      accumulator + (word.trim() === "" ? 0 : word.trim().split(/\s+/u).length),
    0,
  ) ?? 0) + (getChinese(content)?.length ?? 0);

/**
 * 提取 JSON 值中的文本
 *
 * @param content JSON 内容
 * @returns 提取的文本
 */
export const getJSONValue = (content: unknown): string => {
  if (typeof content === "number") return content.toString();
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (Array.isArray(content)) {
      return content.map((item) => getJSONValue(item)).join(", ");
    } else if (content) {
      let result = "";

      Object.values(content as Record<string, unknown>).forEach((value) => {
        result += ` ${getJSONValue(value)}`;
      });

      return result;
    }
  }

  return "";
};

/**
 * 统计目录下所有 JSON 文件的总字数
 *
 * @param dirPath 目录路径
 * @returns 总字数
 */
export const getJSONWordCount = (dirPath: string): number => {
  let words = 0;

  getFileList(dirPath, "json").forEach((filePath) => {
    const pageContent = JSON.parse(
      readFileSync(path.resolve(dirPath, filePath), {
        encoding: "utf-8",
      }),
    ) as unknown;

    const content = getJSONValue(pageContent);

    words += getWordNumber(content);
  });

  return words;
};
