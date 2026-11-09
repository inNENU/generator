import { escapeHtml } from "../../utils.js";
import type { TableComponentOptions } from "./schema.js";
import { checkTable } from "./schema.js";

const formatCell = (cell: string): string =>
  escapeHtml(cell)
    // 必须先转义反斜杠再转义管道：若先处理管道，输入 `\|` 会变成 `\\|`，
    // 多出的反斜杠会被 cmark-gfm/markdown-it 等解析器静默丢弃；
    // remark-gfm/micromark 等解析器还可能把 `|` 当作列分隔符，把该单元格拆成额外一列。
    .replaceAll("\\", String.raw`\\`)
    .replaceAll("|", String.raw`\|`)
    .replaceAll(/\r?\n/gu, "<br />");

export const getTableMarkdown = (table: TableComponentOptions, location = ""): string => {
  if (table.env && !table.env.includes("web")) return "";

  checkTable(table, location);

  const { caption, header, body } = table;

  return `\
${caption ? `### ${escapeHtml(caption)}\n\n` : ""}\
| ${header.map((cell) => formatCell(cell)).join(" | ")} |
| ${header.map(() => ":-:").join(" | ")} |
| ${body.map((item) => item.map((cell) => formatCell(cell)).join(" | ")).join(" |\n| ")} |

`;
};
