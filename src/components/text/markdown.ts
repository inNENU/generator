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

export const getTextMarkdown = (text: TextComponentOptions, location = ""): string => {
  if (text.env && !text.env.includes("web")) return "";

  checkText(text, location);

  // 处理段落（不修改传入的对象）
  const texts = typeof text.text === "string" ? [text.text] : (text.text ?? []);

  const { align, tag, header } = text;
  const shouldUseContainer = "type" in text && text.type !== "none";

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

${
  "action" in text
    ? text.action === "official"
      ? `- [查看详情](https://open.weixin.qq.com/qr/code?username=${text.username})\n\n`
      : text.action === "article"
        ? `- [查看详情](${text.url})\n\n`
        : ""
    : "path" in text && text.path
      ? `- [查看详情](${getMarkdownPath(text.path)})\n\n`
      : ""
}\
${shouldUseContainer ? ":::\n\n" : ""}\
${align ? `::::\n\n` : ""}\
`;
};
