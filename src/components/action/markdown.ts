import { sanitizeUrl } from "../../helpers/url.js";
import {
  escapeHtml,
  escapeMarkdownLinkLabel,
  formatMarkdownDestination,
  getFileLink,
} from "../../utils.js";
import type { ActionComponentOptions } from "./schema.js";
import { checkAction } from "./schema.js";

/** Action 组件的双端 URL 转换结果 */
export interface ActionUrlConversion {
  /** 小程序端跳转形式 */
  miniapp: string;
  /** 网页端地址 */
  web: string;
}

/** Action 组件 Markdown 生成选项 */
export interface ActionMarkdownOptions {
  /** 渲染模式 */
  mode?: "web" | "miniapp";
  /**
   * URL 转换器
   *
   * 可返回单一地址（网页管线）或 `{ miniapp, web }`（知识库管线，按模式取对应形式）。
   */
  urlConverter?: (url: string) => string | ActionUrlConversion | null | undefined;
}

/**
 * 生成代码围栏
 *
 * 围栏长度必须大于内容中最长的连续反引号，否则内容里的连续反引号会提前闭合围栏，把后续内容当作正文解析。
 *
 * @param content 代码块内容
 * @returns 至少三个反引号组成的围栏
 */
const getCodeFence = (content: string): string => {
  const longest = (content.match(/`+/gu) ?? []).reduce((max, run) => Math.max(max, run.length), 0);

  return "`".repeat(Math.max(3, longest + 1));
};

/**
 * 生成 action 组件 Markdown
 *
 * @param action Action 组件数据
 * @param location 组件位置
 * @param options 生成选项
 * @returns Markdown 内容
 */
export const getActionMarkdown = (
  action: ActionComponentOptions,
  location = "",
  options: ActionMarkdownOptions = {},
): string => {
  if (action.env && !action.env.includes("web")) return "";

  checkAction(action, location);

  const { content: rawContent, header } = action;

  // 经 urlConverter 转换（web/miniapp 各自取对应形式），否则 $ 前缀资源引用转为完整 URL
  const converted = options.urlConverter?.(rawContent);
  const content = converted
    ? typeof converted === "string"
      ? converted
      : options.mode === "miniapp"
        ? converted.miniapp
        : converted.web
    : (getFileLink(rawContent) ?? rawContent);

  const safeContent = sanitizeUrl(content);
  const isLink =
    safeContent != null &&
    (/^https?:\/\//u.test(safeContent) ||
      /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/u.test(
        safeContent,
      ));

  const body = isLink
    ? `[${escapeMarkdownLinkLabel(escapeHtml(header ?? safeContent))}](${formatMarkdownDestination(
        safeContent,
      )})`
    : `${getCodeFence(content)}text\n${content}\n${getCodeFence(content)}`;

  if (options.mode === "miniapp") {
    return `\
${header ? `#### ${escapeHtml(header)}\n\n` : ""}\
::: action
${body}
:::

`;
  }

  return `\
${header ? `#### ${escapeHtml(header)}\n\n` : ""}\
${body}
`;
};
