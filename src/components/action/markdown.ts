import { getFileLink } from "../../utils.js";
import type { ActionComponentOptions } from "./schema.js";
import { checkAction } from "./schema.js";

export const getActionMarkdown = (action: ActionComponentOptions, location = ""): string => {
  if (action.env && !action.env.includes("web")) return "";

  checkAction(action, location);

  const { content: rawContent, header } = action;

  // $ 前缀资源引用（$file/$img）转为完整 URL，与 img/doc 组件保持一致
  const content = getFileLink(rawContent) ?? rawContent;

  const isLink =
    /^https?:\/\//u.test(content) ||
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/u.test(
      content,
    );

  return `\
${header ? `#### ${header}\n\n` : ""}\
${
  isLink
    ? `\
[${header ?? content}](${content})
`
    : `\
\`\`\`text
${content}
\`\`\`
`
}
`;
};
