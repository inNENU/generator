import { readFileSync } from "node:fs";
import path from "node:path";

import type { ComponentOptions, PageConfig } from "../page/schema.js";
import { getFileList } from "./getFileList.js";

const urlPattern = /(?:https?:\/\/|www\.)\S+/giu;
const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const wordPattern = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;
const emojiPattern = /\p{Extended_Pictographic}/u;

/**
 * 统计内容中的 emoji 数量
 *
 * @param content 需要统计的内容
 * @returns Emoji 数量（按 grapheme 计，一个组合 emoji 算 1）
 */
const getEmojiNumber = (content: string): number => {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

  return [...segmenter.segment(content)].filter(({ segment }) => emojiPattern.test(segment)).length;
};

/**
 * 统计字符串的字数
 *
 * 按字统计 CJK/日文假名/韩文，按词统计拉丁/西里尔等语言，emoji 按 grapheme 计 1； 链接（http(s):// 与 www.）不计入字数。
 *
 * @param content 需要统计字数的内容
 * @returns 内容中的字数
 */
export const getWordNumber = (content: string): number => {
  if (!content) return 0;

  const withoutUrls = content.replaceAll(urlPattern, " ");
  const cjkNumber = withoutUrls.match(cjkPattern)?.length ?? 0;
  const withoutCjk = withoutUrls.replaceAll(cjkPattern, " ");
  const wordNumber = withoutCjk.match(wordPattern)?.length ?? 0;

  return wordNumber + cjkNumber + getEmojiNumber(withoutUrls);
};

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
 * 各组件中计入字数的顶层文本字段
 *
 * 只统计面向用户的文本字段，不统计链接、图片、坐标、号码、ID、样式与配置字段。
 */
const textFieldKeys = {
  account: ["name", "detail", "desc"],
  action: ["header", "content"],
  audio: ["name"],
  card: ["title", "desc", "name"],
  doc: ["name"],
  footer: ["desc"],
  "functional-list": ["header", "footer"],
  grid: ["header", "footer"],
  img: ["desc"],
  list: ["header", "footer"],
  location: ["header"],
  phone: [
    "header",
    "fName",
    "lName",
    "org",
    "remark",
    "nick",
    "province",
    "city",
    "street",
    "title",
  ],
  table: ["caption"],
  title: ["text"],
  video: ["title"],
} as const satisfies Partial<Record<ComponentOptions["tag"], readonly string[]>>;

/**
 * 提取组件中计入字数的文本字段
 *
 * @param component 页面组件
 * @returns 组件文本字段数组
 */
const getComponentTextFields = (component: ComponentOptions): string[] => {
  const fields: string[] = [];

  const push = (field: string | false | null | undefined): void => {
    if (typeof field === "string" && field) fields.push(field);
  };

  textFieldKeys[component.tag as keyof typeof textFieldKeys]?.forEach((key) => {
    push(
      (component as unknown as Record<string, unknown>)[key] as string | false | null | undefined,
    );
  });

  switch (component.tag) {
    case "grid": {
      component.items.forEach((item) => {
        push(item.text);
      });
      break;
    }
    case "list": {
      component.items.forEach((item) => {
        push(item.text);
        push(item.desc);
      });
      break;
    }
    case "functional-list": {
      component.items.forEach((item) => {
        push(item.text);
        push(item.desc);

        // 选择器的选项也是面向用户的文本
        if ("type" in item && item.type === "picker") {
          item.select.forEach((value) => {
            push(String(value));
          });
        }
      });
      break;
    }
    case "location": {
      component.points.forEach((point) => {
        push(point.name);
        push(point.detail);
      });
      break;
    }
    case "table": {
      component.header.forEach((item) => {
        push(item);
      });
      component.body.forEach((row) => {
        row.forEach((item) => {
          push(item);
        });
      });
      break;
    }
    case "text":
    case "p":
    case "ul":
    case "ol": {
      push(component.header);
      if (Array.isArray(component.text)) {
        component.text.forEach((item) => {
          push(item);
        });
      } else {
        push(component.text);
      }
      break;
    }
    case "video": {
      component.danmuList?.forEach((danmu) => {
        push(danmu.text);
      });
      break;
    }
    // 其余组件的文本字段已由 textFieldKeys 处理
    case "account":
    case "action":
    case "audio":
    case "card":
    case "carousel":
    case "doc":
    case "footer":
    case "img":
    case "phone":
    case "title": {
      break;
    }
    default: {
      break;
    }
  }

  return fields;
};

/**
 * 统计页面组件中的文本字数
 *
 * 只统计面向用户的文本字段（标题、描述、正文、名称、备注、地址等）， 不统计链接、图片、文件、坐标、号码、ID、样式与配置字段。
 *
 * @param component 页面组件
 * @returns 组件文本字数
 */
const getComponentWordNumber = (component: ComponentOptions): number =>
  getComponentTextFields(component).reduce((total, field) => total + getWordNumber(field), 0);

/**
 * 统计页面字数
 *
 * 只统计面向用户的文本字段（页面标题、描述、摘要与正文组件中的文本）， 不统计引用来源（cite）、图片/文件链接、图标、号码、ID、样式与配置字段。
 *
 * @param page 页面配置
 * @returns 页面字数
 */
export const getPageWordCount = (page: PageConfig): number => {
  if (!page) return 0;

  let words = 0;

  if (page.title) words += getWordNumber(page.title);
  if (page.desc) words += getWordNumber(page.desc);
  if (page.summary) words += getWordNumber(page.summary);

  page.content?.forEach((component) => {
    words += getComponentWordNumber(component);
  });

  return words;
};

/**
 * 统计目录下所有 JSON 文件的总字数
 *
 * 该函数会统计目录下所有 JSON 文件中的全部文本（包括链接、配置等）。 如需只统计页面正文，请使用 {@link getFolderPageWordCount}。
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

/**
 * 统计目录下所有页面 JSON 文件的总字数
 *
 * 只统计页面中的文本字段，不统计引用来源（cite）、图片/文件链接等，见 {@link getPageWordCount}。
 *
 * @param dirPath 目录路径
 * @returns 总字数
 */
export const getFolderPageWordCount = (dirPath: string): number => {
  let words = 0;

  getFileList(dirPath, "json").forEach((filePath) => {
    const pageContent = JSON.parse(
      readFileSync(path.resolve(dirPath, filePath), {
        encoding: "utf-8",
      }),
    ) as PageConfig;

    words += getPageWordCount(pageContent);
  });

  return words;
};
