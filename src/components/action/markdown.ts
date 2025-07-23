import type { ActionComponentOptions } from "./schema.js";
import { checkAction } from "./schema.js";

export const getActionMarkdown = (
  action: ActionComponentOptions,
  location = "",
): string => {
  if (action.env && !action.env.includes("web")) return "";

  checkAction(action, location);

  const { content, header } = action;
  const isLink =
    /^https?:\/\//.test(content) ||
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/.test(
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
