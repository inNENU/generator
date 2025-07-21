import type { TextComponentOptions } from "./schema.js";
import { checkText } from "./schema.js";
import { getMarkdownPath, indentMarkdownListItem } from "../../utils.js";

export const getTextMarkdown = (text: TextComponentOptions): string => {
  if (text.env && !text.env.includes("web")) return "";

  checkText(text);

  // 处理段落
  if (typeof text.text === "string") text.text = [text.text];

  const { align, tag, header } = text;
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
    ? `::: ${text.type === "danger" ? "caution" : text.type}${
        typeof header === "string" ? ` ${header}` : ""
      }`
    : typeof header === "string"
      ? `### ${header}`
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
    .join("\n\n") || ""
}

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
