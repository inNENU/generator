import type { TextComponentOptions } from "./typings.js";
import {
  getMarkdownPath,
  indentMarkdownListItem,
  resolveStyle,
} from "../../utils.js";

export const getTextMarkdown = (text: TextComponentOptions): string => {
  // 处理样式
  if (typeof text.style === "object") text.style = resolveStyle(text.style);

  // 处理段落
  if (typeof text.text === "string") text.text = [text.text];

  const { align, tag, heading } = text;
  const shouldUseContainer = "type" in text && text.type !== "none";

  return `\
${
  align
    ? `:::: ${align}

`
    : ""
}\
${
  shouldUseContainer
    ? `${`::: ${text.type === "danger" ? "caution" : text.type}`}${
        typeof heading === "string" ? ` ${heading}` : ""
      }`
    : typeof heading === "string"
      ? `### ${heading}`
      : ""
}
${
  (text.text ?? [])
    .map((item) =>
      tag === "ul"
        ? `- ${indentMarkdownListItem(item, 3)}`
        : tag === "ol"
          ? `1. ${indentMarkdownListItem(item, 3)}`
          : item,
    )
    ?.join("\n\n") || ""
}

${
  "url" in text && /^https?:\/\//.test(text.url)
    ? `- [查看详情](${text.url})\n\n`
    : "path" in text && !("appId" in text)
      ? `- [查看详情](${getMarkdownPath(text.path)})\n\n`
      : ""
}\
${shouldUseContainer ? ":::\n\n" : ""}\
${align ? `::::\n\n` : ""}\
`;
};
