import type { ActionComponentOptions } from "./typings.js";

export const getActionMarkdown = ({
  content,
  header,
}: ActionComponentOptions): string => {
  const isLink =
    /^https?:\/\//.test(content) ||
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/.test(
      content,
    );

  return `\
${
  header
    ? `\
#### ${header}

`
    : ""
}\
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
