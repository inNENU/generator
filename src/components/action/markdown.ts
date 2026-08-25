import { getFileLink } from "../../utils.js";
import type { ActionComponentOptions } from "./schema.js";
import { checkAction } from "./schema.js";

export const getActionMarkdown = (
  action: ActionComponentOptions,
  location = "",
  options: {
    mode?: "web" | "miniapp";
    urlConverter?: (url: string) => { miniapp: string; web: string } | null | undefined;
  } = {},
): string => {
  if (action.env && !action.env.includes("web")) return "";

  checkAction(action, location);

  const { content: rawContent, header } = action;

  // 经 urlConverter 转换（web/miniapp 各自取对应形式），否则 $ 前缀资源引用转为完整 URL
  const converted = options.urlConverter?.(rawContent);
  const content = converted
    ? options.mode === "miniapp"
      ? converted.miniapp
      : converted.web
    : (getFileLink(rawContent) ?? rawContent);

  const isLink =
    /^https?:\/\//u.test(content) ||
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/u.test(
      content,
    );

  const body = isLink ? `[${header ?? content}](${content})` : `\`\`\`text\n${content}\n\`\`\``;

  if (options.mode === "miniapp") {
    return `\
${header ? `#### ${header}\n\n` : ""}\
::: action
${body}
:::

`;
  }

  return `\
${header ? `#### ${header}\n\n` : ""}\
${body}
`;
};
