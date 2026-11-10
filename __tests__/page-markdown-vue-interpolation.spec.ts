import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";

/**
 * 生成只含一个 text 组件的站点 Markdown
 *
 * @param text 正文
 * @param desc 描述
 * @returns 生成的 Markdown
 */
const renderText = (text: string, desc?: string): string =>
  getPageMarkdown(
    {
      title: "t",
      desc,
      content: [{ tag: "text", text }],
    },
    { mode: "web" },
  );

describe("站点 Markdown 的 Vue 插值中和", () => {
  it("中和正文与描述中的插值", () => {
    const markdown = renderText("x {{7*7}} y", "z {{ 7*7 }} w");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(markdown).toContain("{<!-- -->{7*7}<!-- -->}");
    expect(markdown).toContain("> z {<!-- -->{ 7*7 }<!-- -->} w");
  });

  it("中和行内代码及 HTML 块中的插值", () => {
    const markdown = renderText("`{{7*7}}`\n\n<div>{{7*7}}</div>");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(markdown).toContain("`{<!-- -->{7*7}<!-- -->}`");
    expect(markdown).toContain("{<!-- -->{7*7}<!-- -->}");
  });

  it("顶层围栏代码块也按保守策略中和", () => {
    const markdown = renderText("```js\nconst a = { b: {{7*7}} };\n```");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(markdown).toContain("const a = { b: {<!-- -->{7*7}<!-- -->} };");
  });

  it("组件原始 HTML 内的栅栏内容同样中和", () => {
    const markdown = getPageMarkdown(
      {
        title: "t",
        content: [
          {
            tag: "card",
            name: "n",
            title: "t",
            path: "guide/about",
            desc: "x\n```js\n{{7*7}}\n```\n",
          },
        ],
      },
      { mode: "web" },
    );

    expect(markdown).not.toMatch(/\{\{7\*\}\}/u);
    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("中和 :no-v-pre 顶层围栏中的插值", () => {
    const markdown = renderText("```js :no-v-pre\n{{7*7}}\n```");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(markdown).toContain("{<!-- -->{7*7}<!-- -->}");
  });

  it("中和缩进围栏、引用块与列表围栏中的插值", () => {
    const markdown = renderText(
      "  ```js\n  {{7*7}}\n  ```\n\n- ```js\n  {{7*7}}\n  ```",
      "> ```js\n> {{7*7}}\n> ```",
    );

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("中和链接、表格与引用式链接定义中的插值", () => {
    const markdown = renderText(
      "[a]({{7*7}})\n\n| h |\n| - |\n| {{7*7}} |\n\n[ref]: https://example.com/{{7*7}}",
    );

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("处理 CRLF、BOM、tab 与多行行内代码", () => {
    const markdown = renderText("\uFEFF`a\n{{7*7}}`\r\n\r\n\t{{7*7}}");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("描述中的多行行内代码跨引用分隔行也不会执行", () => {
    const markdown = renderText("x", "`{{7*7}}\n`");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("中和反斜杠转义与数字实体形式的花括号", () => {
    const payloads = [
      String.raw`\{\{7*7\}\}`,
      String.raw`\\{\\{7*7\\}\\}`,
      "&#X7B;&#X7B;7*7&#X7D;&#X7D;",
      "&#X7B;{7*7&#125;}",
      String.raw`\}&#123;7*7\{&#125;`,
    ];

    for (const desc of payloads) expect(renderText("x", desc)).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("对已含注释的文本保持幂等（不会二次拆开）", () => {
    const markdown = renderText("{<!-- -->{7*7}<!-- -->}");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
  });

  it("中和实体链且不吞掉裸 & 周围的文本", () => {
    const payloads = [
      "&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;",
      "&#x26;#123;&#x26;#123;7*7&#x26;#125;&#x26;#125;",
      "&#X26;#x7B;&#X26;#x7B;7*7&#X26;#x7D;&#X26;#x7D;",
      "&AMP;#123;&AMP;#123;7*7&AMP;#125;&AMP;#125;",
      "&#x00026;#123;7*7&#x00026;#125;",
      "&#38;#123;{7*7&#38;&#125;}",
    ];

    for (const desc of payloads) expect(renderText("x", desc)).not.toMatch(/\{\{7\*7\}\}/u);

    const keepAmpersand = renderText("x", "R&D notes: &#123;x&#125;");

    expect(keepAmpersand).toContain("R&D notes:");
    expect(keepAmpersand).not.toContain("&#123;");

    const keepUrl = renderText("x", "See [x](https://e.com/?a=1&b=2) or &#123;");

    expect(keepUrl).toContain("a=1&b=2");
    expect(keepUrl).not.toContain("&#123;");
  });
});
