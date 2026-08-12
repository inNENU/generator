/** URL 处理器，返回处理后的路径，返回 null 表示不展示 */
export type UrlHandler = (url: string) => string | null | undefined;

/** Markdown 生成选项 */
export interface MarkdownOptions {
  /** 内容位置 */
  location?: string;
  /** URL 转换器（见 `UrlHandler`） */
  urlConverter?: UrlHandler;
}

export type * from "./components/schema.js";
export type * from "./schema/index.js";
export type * from "./page/schema.js";
export type * from "./generator/typings.js";
