import { getSafeUrl, sanitizeUrl } from "../../helpers/url.js";
import type { EscapeContainerBodySyntaxOptions } from "../../utils.js";
import {
  escapeContainerBodySyntax,
  escapeHtml,
  getMarkdownPath,
  indentMarkdownListItem,
} from "../../utils.js";
import type { TextComponentOptions } from "./schema.js";
import { checkText } from "./schema.js";

/**
 * 生成单个正文段落或列表项
 *
 * @param item 段落文字
 * @param tag 文字标签
 * @param options 行首语法转义选项
 * @returns Markdown 内容
 */
const renderTextBodyItem = (
  item: string,
  tag: TextComponentOptions["tag"],
  options: EscapeContainerBodySyntaxOptions,
): string => {
  const content = escapeContainerBodySyntax(escapeHtml(item), options);

  if (tag === "ul") return `- ${indentMarkdownListItem(content, 3)}`;

  if (tag === "ol") return `1. ${indentMarkdownListItem(content, 3)}`;

  return content;
};

/**
 * 生成正文行首语法转义选项
 *
 * 普通正文保留标题与围栏语义，只拦截可能被解析成容器的行首 `:::`； 容器正文不转义标题，围栏仅在未成对时转义，避免正常代码块被拍平。
 *
 * @param shouldUseContainer 是否输出 `:::` 容器
 * @returns 转义选项
 */
const getTextBodyEscapeOptions = (shouldUseContainer: boolean): EscapeContainerBodySyntaxOptions =>
  shouldUseContainer ? { fence: "unclosed", heading: false } : { fence: false, heading: false };

/**
 * 生成正文组件的“查看详情”链接
 *
 * @param text 正文组件
 * @returns Markdown 链接行，地址不安全或缺失时为空串
 */
const getActionContent = (text: TextComponentOptions): string => {
  if ("action" in text) {
    if (text.action === "official")
      return `- [查看详情](https://open.weixin.qq.com/qr/code?username=${text.username})\n\n`;

    if (text.action !== "article") return "";

    const url = sanitizeUrl(text.url);

    return url ? `- [查看详情](${url})\n\n` : "";
  }

  if ("path" in text && text.path) {
    const safePath = getSafeUrl(getMarkdownPath(text.path));

    return safePath?.kind === "relative" ? `- [查看详情](${safePath.url})\n\n` : "";
  }

  return "";
};

export const getTextMarkdown = (text: TextComponentOptions, location = ""): string => {
  if (text.env && !text.env.includes("web")) return "";

  checkText(text, location);

  // 处理段落（不修改传入的对象）
  const texts = typeof text.text === "string" ? [text.text] : (text.text ?? []);

  const { align, tag, header } = text;
  const shouldUseContainer = "type" in text && text.type !== "none";
  const actionContent = getActionContent(text);

  // 普通正文保留标题与围栏语义，容器正文仅在围栏未成对时转义，避免正常代码块被拍平。
  const bodyEscapeOptions = getTextBodyEscapeOptions(shouldUseContainer);

  return `\
${
  align
    ? `:::: ${align}

`
    : ""
}\
${
  shouldUseContainer
    ? `::: ${text.type === "danger" ? "caution" : text.type}${
        typeof header === "string" ? ` ${escapeHtml(header)}` : ""
      }`
    : typeof header === "string"
      ? `### ${escapeHtml(header)}`
      : ""
}
${texts.map((item) => renderTextBodyItem(item, tag, bodyEscapeOptions)).join("\n\n") || ""}

${actionContent}\
${shouldUseContainer ? ":::\n\n" : ""}\
${align ? `::::\n\n` : ""}\
`;
};
