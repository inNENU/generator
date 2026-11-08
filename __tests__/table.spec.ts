import { describe, expect, it } from "vitest";

import { getTableMarkdown } from "../src/components/table/markdown.js";
import type { TableComponentOptions } from "../src/components/table/schema.js";
import { checkTable } from "../src/components/table/schema.js";

const createTable = (header: string[], body: string[][]): TableComponentOptions => ({
  tag: "table",
  header,
  body,
});

describe(getTableMarkdown, () => {
  it("keeps multi-line cells on one table row", () => {
    const markdown = getTableMarkdown(createTable(["名称", "说明"], [["A", "第一行\n第二行"]]));

    expect(markdown).toContain("第一行<br />第二行");
    expect(markdown).not.toContain("第一行\n第二行");
    expect(markdown.split("\n").filter((line) => line.startsWith("|"))).toHaveLength(3);
  });

  it("escapes pipes and HTML in cells", () => {
    const markdown = getTableMarkdown(createTable(["a|b"], [["<script>alert(1)</script>"]]));

    expect(markdown).toContain(String.raw`a\|b`);
    expect(markdown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markdown).not.toContain("<script>");
  });

  it("keeps a literal backslash-pipe pair inside one cell", () => {
    const markdown = getTableMarkdown(createTable(["列"], [[String.raw`a\|b`]]));
    const row = markdown.split("\n").find((line) => line.startsWith("| a"));

    // 输入为反斜杠 + 管道；先转义反斜杠再转义管道，得到 `\\` + `\|`。
    expect(row).toBe(String.raw`| a\\\|b |`);
  });

  it("doubles literal backslashes so they combine correctly with pipe escaping", () => {
    const markdown = getTableMarkdown(createTable(["列"], [[String.raw`a\\b`]]));
    const row = markdown.split("\n").find((line) => line.startsWith("| a"));

    expect(row).toBe(String.raw`| a\\\\b |`);
  });

  it("escapes a lone pipe as a cell character", () => {
    const markdown = getTableMarkdown(createTable(["|"], [["|"]]));

    expect(markdown).toContain(String.raw`| \| |`);
  });
});

describe(checkTable, () => {
  it("reports mismatched column counts with row numbers", () => {
    const issues = checkTable(createTable(["名称", "说明"], [["只有一列"]]), "guide/table");

    expect(issues).not.toStrictEqual([]);
    expect(issues[0]).toContain("第 1 行");
    expect(issues[0]).toContain("期望 2 列");
    expect(issues[0]).toContain("实际 1 列");
  });

  it("returns no issues for a valid table", () => {
    expect(checkTable(createTable(["名称", "说明"], [["A", "B"]]))).toStrictEqual([]);
  });
});
