import type { TableComponentOptions } from "./schema.js";
import { checkTable } from "./schema.js";

export const getTableMarkdown = (
  table: TableComponentOptions,
  location = "",
): string => {
  if (table.env && !table.env.includes("web")) return "";

  checkTable(table, location);

  const { caption, header, body } = table;

  return `\
${caption ? `### ${caption}\n\n` : ""}\
| ${header.map((item) => item.replace(/\|/g, "\\|")).join(" | ")} |
| ${header.map(() => ":-:").join(" | ")} |
| ${body
    .map((item) => item.map((item) => item.replace(/\|/g, "\\|")).join(" | "))
    .join(" |\n| ")} |

`;
};
