import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const raw = "{{ 7*7 }}";
const neutralized = "{<!-- -->{ 7*7 }<!-- -->}";

const markdownIt = new MarkdownIt({ html: true });

const createPage = (content: PageConfig["content"], desc?: string): PageConfig => ({
  title: "t",
  ...(desc ? { desc } : {}),
  content,
});

const expectNeutralized = (markdown: string): void => {
  expect(markdown).toContain(neutralized);
  expect(markdown).not.toContain("{{");
  expect(markdown).not.toContain("}}");
};

describe("站点 Markdown 的 Vue 插值中和", () => {
  it("中和正文行与标题中的插值", () => {
    const markdown = getPageMarkdown(
      createPage([{ tag: "text", header: `标题 ${raw}`, text: `正文 ${raw}` }]),
      { location: "probe/text" },
    );

    expectNeutralized(markdown);
    expect(markdown).toContain(`### 标题 ${neutralized}`);
    expect(markdown).toContain(`正文 ${neutralized}`);
  });

  it("中和组件文本与页面描述中的插值", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          {
            tag: "card",
            name: `名称 ${raw}`,
            title: `标题 ${raw}`,
            desc: `描述 ${raw}`,
            path: "guide/about",
          },
          { tag: "action", header: `操作 ${raw}`, content: "site://signup" },
        ],
        `页面描述 ${raw}`,
      ),
      {
        location: "probe/component",
        urlConverter: () => "https://example.com/signup",
      },
    );

    expectNeutralized(markdown);
    expect(markdown).toContain(`> 页面描述 ${neutralized}`);
  });

  it("中和连续多个花括号", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "text", text: "{{{ 7*7 }}}" }]), {
      location: "probe/braces",
    });

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
  });

  it("中和字符引用与反斜杠转义形式", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: String.raw`正文 \{\{ 7*7 \}\}` },
          {
            tag: "table",
            caption: "表格 {{ 7*7 }}",
            header: ["列 {{ 7*7 }}"],
            body: [["值 {{ 7*7 }}"]],
          },
        ],
        "&#123;&#123; 7*7 &#125;&#125;",
      ),
      { location: "probe/encoded" },
    );
    const html = markdownIt.render(markdown);

    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(html).toContain("<!-- -->");
  });

  it("中和伪装成链接与不成对代码标记的插值", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: "x]({{ 7*7 }})" },
          { tag: "text", text: "[x](https://example.com/{{ 7*7 }})" },
          { tag: "text", text: "`` {{ 7*7 }} `" },
        ],
        "<x {{ 7*7 }}>\n\n[x]({{ 7*7 }})\n\n]({{{ 7*7 }}})",
      ),
      { location: "probe/bypass" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("中和转义反引号、缩进代码与伪占位符", () => {
    const markdown = getPageMarkdown(
      createPage([
        { tag: "text", text: "\\`{{ 7*7 }}\\`" },
        { tag: "text", text: "    `{{ 7*7 }}`" },
        { tag: "text", text: "```\n{{ 7*7 }}\n```\n\uE0001\uE001" },
      ]),
      { location: "probe/escape" },
    );

    expect(markdown).not.toContain("\\`{{ 7*7 }}\\`");
    expect(markdown).not.toContain("    `{{ 7*7 }}`");
    expect(markdown.match(/\{\{ 7\*7 \}\}/gu)).toHaveLength(1);
    expect(markdown).toContain("\uE0001\uE001");
  });

  it("保留代码与属性中的原始花括号", () => {
    const markdown = getPageMarkdown(
      createPage([
        { tag: "text", text: "```\n{{ 7*7 }}\n```\n\n`{{ 7*7 }}`" },
        { tag: "img", src: "https://example.com/a.png", desc: "{{ 7*7 }}" },
      ]),
      { location: "probe/code" },
    );

    expect(markdown).toContain("```\n{{ 7*7 }}\n```");
    expect(markdown).toContain("`{{ 7*7 }}`");
    expect(markdown).toContain('alt="{{ 7*7 }}"');
  });

  it("中和原始 HTML 组件与描述中的代码片段", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          {
            tag: "card",
            name: "n",
            title: "t",
            path: "guide/about",
            desc: "`{{ 7*7 }}`",
          },
        ],
        "<pre>\n`{{ 7*7 }}`\n</pre>\n\n" +
          "<pre>\n```\n{{ 7*7 }}\n```\n</pre>\n\n" +
          "<x>\n`{{ 7*7 }}`\n</x>\n\n" +
          '<x a="b">\n```\n{{ 7*7 }}\n```\n</x>\n\n' +
          '<span title="`"> {{ 7*7 }} `</span>\n\n' +
          '<em title="`"> {{ 7*7 }} `</em>\n\n' +
          '- <div title="`"> {{ 7*7 }} </div>',
      ),
      { location: "probe/raw-html" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(markdown).toContain('<span title="`">');
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理关闭 v-pre、非法围栏与非法注释", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: "``` text :no-v-pre\n{{ 7*7 }}\n```" },
          { tag: "text", text: "``` js `x`\n{{ 7*7 }}\n```" },
          { tag: "text", text: "```:no\\-v-pre\n{{ 7*7 }}\n```" },
        ],
        "<!--> {{ 7*7 }} -->\n\nx <!-- ` --> {{ 7*7 }} `\n\n<pre>\n</pre >\n`{{ 7*7 }}`\n</pre>",
      ),
      { location: "probe/edge" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理列表内代码、实体禁用 v-pre 与多行注释", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: "-     `{{ 7*7 }}`" },
          { tag: "text", text: "~~~ text `x` :no-v-pre\n```\n{{ 7*7 }}\n```\n~~~" },
          { tag: "text", text: "- ``` text :no-v-pre\n  `{{ 7*7 }}`\n  ```" },
        ],
        "``` text &#58;no-v-pre\n{{ 7*7 }}\n```\n\n" +
          "`<!-- ` {{ 7*7 }} -->`\n\n" +
          "`<!-- ` --> {{ 7*7 }} `\n\n" +
          "x <!--\n{{ 7*7 }}\n-->",
      ),
      { location: "probe/nested" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理代码中形似 HTML 标签的文本", () => {
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: '> ``` text :no-v-pre\n> <div a="{{ 7*7 }}">\n> ```' },
          { tag: "text", text: '- ``` text :no-v-pre\n  <div a="{{ 7*7 }}">\n  ```' },
        ],
        ['    <div a="{{ 7*7 }}">', '``` text :no-v-pre\n<div a="{{ 7*7 }}">\n```'].join("\n\n"),
      ),
      { location: "probe/code-tag" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理转义反引号、注释与 HTML 标签", () => {
    const markdown = getPageMarkdown(
      createPage(
        [{ tag: "text", text: "`a\\` {{ 7*7 }}`" }],
        [
          "`a\\` {{ 7*7 }}`",
          String.raw`\<!-- {{ 7*7 }} -->`,
          "x <!--a -- b {{ 7*7 }} -->",
          "x <!--{{ 7*7 }}x <!-- -->",
          String.raw`\<x a={{7*7}}>`,
          String.raw`\<x a="{{ 7*7 }}">`,
          String.raw`\<img alt={{7*7}}>`,
        ].join("\n\n"),
      ),
      { location: "probe/escaped" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("保留行内代码中 HTML 注释的原文", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "text", text: "`<!-- {{ 7*7 }} -->`" }]), {
      location: "probe/code-comment",
    });

    expect(markdown).toContain("{{ 7*7 }}");
    expect(markdown).not.toContain("&#123;");
  });

  it("不影响文本管线的原始内容", () => {
    const page = createPage([{ tag: "text", header: `标题 ${raw}`, text: `正文 ${raw}` }]);
    const text = getPageText(page, "probe/text");

    expect(text).toContain(raw);
    expect(text).not.toContain("<!-- -->");
  });
});
