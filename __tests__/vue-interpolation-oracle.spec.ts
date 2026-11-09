import { figure as figurePlugin } from "@mdit/plugin-figure";
import { compile } from "@vue/compiler-dom";
import { createMarkdown as createVuePressMarkdown } from "@vuepress/markdown";
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
  ["反斜杠转义花括号", String.raw`\\{\\{7*7\\}\\}`],
  ["奇数反斜杠转义花括号", String.raw`\\\{\\\{7*7\\\}\\\}`],
  ["大写 X 实体花括号", "&#X7B;&#X7B;7*7&#X7D;&#X7D;"],
  ["大写 X 混合实体花括号", "&#X7B;{7*7&#125;}"],
  ["反斜杠转义与实体混合", String.raw`\\{&#123;7*7\\}\}`],
  ["未闭合 no-v-pre 围栏", "```js :no-v-pre\n    ```\n`{{7*7}}`"],
  ["列表续行围栏", "- item\n  ```js\n{{7*7}}"],
  ["相邻围栏", "- ~~~js\n- ```md :no-v-pre\n  {{7*7}}"],
  ["引用内列表围栏", "> - ```js\n>   {{7*7}}\n>   ```"],
];

describe("vue 插值中和的编译级验证", () => {
  it.each(cases)("中和后不产生 Vue 插值：%s", (_name, markdown) => {
    expect(hasInterpolation(escapeVueInterpolation(markdown))).toBe(false);
  });

  it("顶层围栏也中和，但仍不产生插值", () => {
    const markdown = escapeVueInterpolation("```js\nconst a = { b: {{7*7}} };\n```");

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
    expect(hasInterpolation(markdown)).toBe(false);
  });

  it("组件原始 HTML 块中的栅栏不经 markdown-it 解析，也不会执行", () => {
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

    expect(markdown).not.toMatch(/\{\{7\*7\}\}/u);
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

describe("@mdit/plugin-figure 对图片 title 的二次解码", () => {
  /**
   * 用真实 VuePress Markdown 与 figure 插件渲染
   *
   * @param markdown 生成的 Markdown
   * @returns 渲染后的 HTML
   */
  const renderWithFigure = (markdown: string): string => {
    const instance = createVuePressMarkdown();

    // @vuepress/markdown 依赖 @types/markdown-it@14，而本仓库直接依赖 markdown-it@15，类型不兼容但运行时兼容
    instance.use(figurePlugin as unknown as Parameters<typeof instance.use>[0]);

    return instance.render(markdown);
  };

  const payloads: [string, string][] = [
    ["desc 实体 title", '![a](x "&#123;&#123;7*7&#125;&#125;")'],
    ["desc 大写 X 实体 title", '![a](x "&#X7B;&#X7B;7*7&#X7D;&#X7D;")'],
    ["desc 双编码实体 title", '![a](x "&amp;#123;&amp;#123;7*7&amp;#125;&amp;#125;")'],
    ["desc 命名实体 title", '![a](x "&lcub;&lcub;7*7&rcub;&rcub;")'],
    ["desc 混合实体与字面花括号", '![a](x "&#123;{7*7&#125;}")'],
    ["desc 实体编码的 & 前缀（十进制）", '![a](x "&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;")'],
    [
      "desc 实体编码的 & 前缀（十六进制）",
      '![a](x "&#x26;#123;&#x26;#123;7*7&#x26;#125;&#x26;#125;")',
    ],
    [
      "desc 实体编码的 & 前缀（大写 X）",
      '![a](x "&#X26;#x7B;&#X26;#x7B;7*7&#X26;#x7D;&#X26;#x7D;")',
    ],
    [
      "desc 实体编码的 & 前缀（前导零）",
      '![a](x "&#00038;#000123;&#00038;#000123;7*7&#00038;#000125;&#00038;#000125;")',
    ],
    ["desc 实体 & 加命名实体", '![a](x "&#38;lcub;&#38;lcub;7*7&#38;rcub;&#38;rcub;")'],
    [
      "desc 实体 & 加大写命名实体",
      '![a](x "&#x26;lbrace;&#x26;lbrace;7*7&#x26;rbrace;&#x26;rbrace;")',
    ],
    ["desc 单引号 title", "![a](x '&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;')"],
    ["desc 圆括号 title", "![a](x (&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;))"],
    ["desc linkImage", '[![a](x "&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;")](y)'],
    ["desc refdef title", '![a][r]\n\n[r]: x "&#38;#123;&#38;#123;7*7&#38;#125;&#38;#125;"'],
  ];

  it.each(payloads)("中和后 figure 标题不执行插值：%s", (_name, desc) => {
    const markdown = getPageMarkdown(
      { title: "t", desc, content: [{ tag: "text", text: "x" }] },
      { mode: "web" },
    );
    const html = renderWithFigure(markdown);

    expect(html).not.toMatch(/\{\{7\*7\}\}/u);
    expect(compile(html, { mode: "function" }).code).not.toContain("_toDisplayString");
  });
});
