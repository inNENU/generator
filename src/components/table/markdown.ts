import type { TableComponentOptions } from "./typings.js";

export const getTableMarkdown = ({
  caption,
  header,
  body,
}: TableComponentOptions): string =>
  `\
${
  caption
    ? `### ${caption}

`
    : ""
}\
| ${header.map((item) => item.replace(/\|/g, "\\|")).join(" | ")} |
| ${header.map(() => ":-:").join(" | ")} |
| ${body
    .map((item) => item.map((item) => item.replace(/\|/g, "\\|")).join(" | "))
    .join(" |\n| ")} |

`;
