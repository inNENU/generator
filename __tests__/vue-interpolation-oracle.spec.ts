import { compile } from "@vue/compiler-dom";
import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import { escapeVueInterpolation } from "../src/vue-interpolation.js";

/** MarkdownIt 实例类型 */
type MarkdownInstance = InstanceType<typeof MarkdownIt>;

/**
 * 复刻 VuePress 的 v-pre 行为：围栏默认 v-pre，`:no-v-pre` 关闭；行内代码加 v-pre
 *
 * @returns 配置好的 MarkdownIt 实例
 */
const createMarkdown = (): MarkdownInstance => {
  const markdown = new MarkdownIt({ html: true });
  const renderFence = markdown.renderer.rules.fence;

  markdown.renderer.rules.fence = (...args): string => {
    const token = args[0][args[1]];
    const info = token.info ? markdown.utils.unescapeAll(token.info).trim() : "";
    let result = renderFence(...args);

    if (!/:no-v-pre\b/u.test(info) || /:v-pre\b/u.test(info))
      result = `<pre v-pre${result.slice(4)}`;

    return result;
  };

  const renderInlineCode = markdown.renderer.rules.code_inline;
  markdown.renderer.rules.code_inline = (...args): string =>
    `<code v-pre${renderInlineCode(...args).slice(5)}`;

  return markdown;
};

/**
 * 渲染并编译，返回是否包含 Vue 插值渲染函数
 *
 * @param markdown 生成的 Markdown
 * @returns 是否产生插值
 */
const hasInterpolation = (markdown: string): boolean => {
  const html = createMarkdown().render(markdown);
  const { code } = compile(html, { mode: "function" });

  return code.includes("_toDisplayString");
};

const cases: [string, string][] = [
  ["正文", "x {{7*7}} y"],
  ["行内代码", "`{{7*7}}`"],
  ["HTML 文本", "<div>{{7*7}}</div>"],
  ["链接目的地", "[a]({{7*7}})"],
  ["链接 title", '[a](https://x "{{7*7}}")'],
  ["表格单元格", "| h |\n| - |\n| {{7*7}} |"],
  ["引用式链接定义", "[ref]: https://example.com/{{7*7}}"],
  ["列表围栏", "- ```js\n  {{7*7}}\n  ```"],
  ["引用围栏", "> ```js\n> {{7*7}}\n> ```"],
  ["缩进围栏", "  ```js\n  {{7*7}}\n  ```"],
  ["no-v-pre 围栏", "```js :no-v-pre\n{{7*7}}\n```"],
  ["多行行内代码", "`a\n{{7*7}}`"],
  ["转义反引号", "\\``x`{{7*7}}``"],
  ["autolink 反引号", "`a <https://x/`y> {{7*7}}`"],
  ["autolink 编码花括号", "<https://e/%7B%7B7*7%7D%7D>"],
  ["autolink 实体花括号", "<a&lcub;&lcub;7*7&rcub;&rcub;@b.com>"],
  ["HTML 注释", "<!-- {{7*7}} -->"],
  ["plaintext 标签", "<plaintext>{{7*7}}"],
  ["伪跨行代码", "`{{7*7}}\n`"],
  ["未闭合 no-v-pre 围栏", "```js :no-v-pre\n    ```\n`{{7*7}}`"],
  ["列表续行围栏", "- item\n  ```js\n{{7*7}}"],
  ["相邻围栏", "- ~~~js\n- ```md :no-v-pre\n  {{7*7}}"],
  ["引用内列表围栏", "> - ```js\n>   {{7*7}}\n>   ```"],
];

describe("vue 插值中和的编译级验证", () => {
  it.each(cases)("中和后不产生 Vue 插值：%s", (_name, markdown) => {
    expect(hasInterpolation(escapeVueInterpolation(markdown))).toBe(false);
  });

  it("顶层 v-pre 围栏保留原文且不产生插值", () => {
    const markdown = escapeVueInterpolation("```js\nconst a = { b: {{7*7}} };\n```");

    expect(markdown).toBe("```js\nconst a = { b: {{7*7}} };\n```");
    expect(hasInterpolation(markdown)).toBe(false);
  });

  it("真实页面管线中和正文、描述与多种容器", () => {
    const markdown = getPageMarkdown(
      {
        title: "t",
        desc: "`{{7*7}}\n{{7*7}}}",
        content: [
          { tag: "text", text: "x {{7*7}}\n\n```js :no-v-pre\n{{7*7}}\n```" },
          { tag: "card", title: "{{7*7}}", desc: "{{7*7}}", url: "/x" },
        ],
      },
      { mode: "web" },
    );

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(hasInterpolation(markdown)).toBe(false);
  });
});
