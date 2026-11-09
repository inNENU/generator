import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";
import { escapeVueInterpolation } from "../src/vue-interpolation.js";

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
        "<!--> {{ 7*7 }} -->\n\n<!---> {{ 7*7 }} -->\n\n<!-->\n{{ 7*7 }}\n-->\n\n<!--->\n{{ 7*7 }}\n-->\n\nx <!-- ` --> {{ 7*7 }} `\n\n<pre>\n</pre >\n`{{ 7*7 }}`\n</pre>",
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

  it("处理非法标签、原始文本元素与未闭合围栏", () => {
    const markdown = getPageMarkdown(
      createPage(
        [{ tag: "text", text: "x" }],
        [
          '<x_y a="{{ 7*7 }}">',
          '`<span title="`"> {{ 7*7 }}`',
          '<textarea><div a="{{ 7*7 }}"></textarea>',
          '<textarea>\n<div a="{{ 7*7 }}">\n</textarea>',
          '``` text :no-v-pre\n<div a="{{ 7*7 }}">',
        ].join("\n\n"),
      ),
      { location: "probe/invalid-tag" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理废弃原始文本元素与 plaintext 标签", () => {
    const desc = [
      '<plaintext><div a="{{ 7*7 }}"></div>',
      '<plaintext><div a="{{ 7*7 }}"></div></plaintext>',
      '<listing><div a="{{ 7*7 }}"></div></listing>',
      '<noscript><div a="{{ 7*7 }}"></div></noscript>',
      '<template><div a="{{ 7*7 }}"></div></template>',
    ].join("\n\n");
    const markdown = getPageMarkdown(createPage([{ tag: "text", text: "x" }], desc), {
      location: "probe/plaintext",
    });
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(html).not.toContain("<plaintext");
    expect(html).toContain("&lt;plaintext");
  });

  it("处理无空格伪链接、autolink 文本与闭合标签属性", () => {
    const desc = ["x <https://e.com/`{{7*7}}`>", "x <https://e.com/``{{7*7}}``>"].join("\n\n");
    const markdown = getPageMarkdown(
      createPage(
        [
          { tag: "text", text: "x]({{7*7}})" },
          { tag: "text", text: "x <https://e.com/{{7*7}}>" },
          { tag: "text", text: 'x </x a="{{7*7}}">' },
        ],
        desc,
      ),
      { location: "probe/round-10" },
    );
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(markdown).not.toContain("}}");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("处理嵌套原始文本与列表围栏", () => {
    const desc = [
      '<div><textarea><div a="{{ 7*7 }}"></textarea></div>',
      '- <textarea><div a="{{ 7*7 }}"></textarea>',
      '- ``` text :no-v-pre\n  <div a="{{ 7*7 }}">\n  ```',
      '- ``` text :no-v-pre\n  <div a="{{ 7*7 }}">',
    ].join("\n\n");
    const markdown = getPageMarkdown(createPage([{ tag: "text", text: "x" }], desc), {
      location: "probe/nested-raw-text",
    });
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

  it("链接 destination 的反引号不与正文配对", () => {
    const page = createPage([{ tag: "text", text: "[a](`){{7*7}}`" }], "[a](`){{7*7}}`");
    const markdown = getPageMarkdown(page, { location: "probe/link-dest" });
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(html).not.toContain("{{");
  });

  it("表格单元格按单元格配对反引号", () => {
    const page = createPage([
      { tag: "text", text: "| a` {{7*7}} | b` |\n| --- | --- |" },
      { tag: "table", caption: "c", header: ["h1", "h2"], body: [["a` {{7*7}}", "b`"]] },
    ]);
    const markdown = getPageMarkdown(page, { location: "probe/table-cell" });
    const html = markdownIt.render(markdown);

    expect(markdown).not.toContain("{{");
    expect(html).not.toContain("{{");
  });

  it("伪标签名不按 HTML 标签放过", () => {
    const page = createPage([{ tag: "text", text: '前 <a_b title="{{ 7*7 }}"> 后' }]);
    const markdown = getPageMarkdown(page, { location: "probe/fake-tag" });

    expect(markdown).not.toContain("{{");
    expect(markdownIt.render(markdown)).not.toContain("{{");
  });

  it("残缺链接不会因坐标错位陷入死循环", () => {
    const desc = "[a](x(y`) {{7*7}}`";
    const startedAt = Date.now();
    const markdown = getPageMarkdown(createPage([], desc), {
      location: "probe/link-brace-loop",
    });
    const html = markdownIt.render(markdown);

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(html).not.toContain("{{");
    expect(markdown).not.toContain("{{ 7*7 }}");
  });

  it("链接 destination 含花括号且带反引号", () => {
    const desces = ["[a](`{ ) {{7*7}}`", "[a](`} ) {{7*7}}`", "[a](<`{>) {{7*7}}`"];

    for (const desc of desces) {
      const markdown = getPageMarkdown(createPage([], desc), { location: "probe/link-brace" });
      const html = markdownIt.render(markdown);

      // markdown-it 会把 destination 内的花括号百分号编码，正文里的插值才必须被拆开。
      expect(html).not.toContain("{{");
      expect(markdown).not.toContain("{{");
    }
  });

  it("链接 title 与 autolink 内的反引号不与正文配对", () => {
    const desces = ['[a](https://x "`") {{7*7}}', "<https://x/`> {{7*7}}"];

    for (const desc of desces) {
      const markdown = getPageMarkdown(createPage([], desc), { location: "probe/link-title" });
      const html = markdownIt.render(markdown);

      expect(markdown).not.toContain("{{");
      expect(html).not.toContain("{{");
    }
  });

  it("行首 HTML 注释块不产生嵌套注释", () => {
    const page = createPage([], "<!-- 注释 {{ 7*7 }} 结束 -->");
    const markdown = getPageMarkdown(page, { location: "probe/comment-block" });
    const html = markdownIt.render(markdown);

    expect(markdown).toContain("&#123;");
    expect(markdown).not.toContain("{{");
    // 注释内部插入 `<!-- -->` 会提前结束注释，把余下内容泄漏为可见文本。
    expect(html).not.toContain("<!-- -->");
    expect(html).toContain("<!-- 注释 &#123;&#123; 7*7 &#125;&#125; 结束 -->");
  });

  it("crlf 围栏仍按代码块放过", () => {
    const page = createPage([{ tag: "text", text: "```\r\n{{ 7*7 }}\r\n```" }]);
    const markdown = getPageMarkdown(page, { location: "probe/crlf-fence" });

    expect(markdown).toContain("{{ 7*7 }}");
    expect(markdown).not.toContain("&#123;");
  });

  it("中和可解码 autolink 与容器内缩进代码中的插值", () => {
    const desces = [
      "<https://e/%7B%7B7*7%7D%7D>",
      "<a%7B%7B7*7%7D%7D@b.com>",
      "<a&#123;&#123;7*7&#125;&#125;@b.com>",
      "<a&lcub;&lcub;7*7&rcub;&rcub;@b.com>",
      "<https://e/&lcub;&lcub;7*7&rcub;&rcub;>",
      "- >     `{{7*7}}`",
      "    {{7*7}}",
    ];

    for (const desc of desces) {
      const markdown = getPageMarkdown(createPage([], desc), {
        location: "probe/decoded-autolink",
      });
      const html = markdownIt.render(markdown);

      expect(markdown).not.toContain("{{");
      expect(html).not.toContain("{{");
    }
  });

  it("转义行内与关闭 plaintext 标签且不误伤行内代码", () => {
    const desces = ["前文 <plaintext> 后文 {{7*7}}", "</plaintext>"];

    for (const desc of desces) {
      const markdown = getPageMarkdown(createPage([], desc), {
        location: "probe/inline-plaintext",
      });
      const html = markdownIt.render(markdown);

      expect(markdown).not.toContain("{{");
      expect(html).not.toContain("{{");
      expect(html).not.toContain("<plaintext");
    }

    const codeMarkdown = getPageMarkdown(createPage([], "`<textarea>` 与 `{{ 7 * 7 }}`"), {
      location: "probe/inline-code-fidelity",
    });

    expect(codeMarkdown).toContain("`<textarea>` 与 `{{ 7 * 7 }}`");
    expect(codeMarkdown).not.toContain("<!-- -->");
  });

  it("保留描述代码样本中的标签与花括号", () => {
    const markdown = getPageMarkdown(
      createPage(
        [],
        "```html\n<plaintext>{{ 7*7 }}</plaintext>\n```\n\n`<template>{{ 7*7 }}</template>`",
      ),
      { location: "probe/code-fidelity" },
    );

    expect(markdown).toContain("<plaintext>{{ 7*7 }}</plaintext>");
    expect(markdown).toContain("`<template>{{ 7*7 }}</template>`");
  });

  it("中和跨行行内代码与转义反引号中的插值", () => {
    const texts = ["`a\nb` {{7*7}}", "`\n`{{7*7}}", "\\``x`{{7*7}}`"];

    for (const text of texts) {
      const markdown = getPageMarkdown(createPage([{ tag: "text", text }]), {
        location: "probe/multiline-code",
      });
      const html = markdownIt.render(markdown);

      expect(markdown).not.toContain("{{");
      expect(html).not.toContain("{{");
    }
  });

  it("保留 v-pre 列表围栏与引用式链接定义", () => {
    const fence = escapeVueInterpolation("- ```js\n  {{7*7}}\n  ```");

    expect(fence).toContain("{{7*7}}");
    expect(fence).not.toContain("<!-- -->");

    const reference = escapeVueInterpolation("[ref]: https://example.com/{{7*7}}\n\n[a][ref]");
    const html = markdownIt.render(reference);

    expect(reference).toContain("https://example.com/%7B%7B7*7%7D%7D");
    expect(html).toContain('href="https://example.com/%7B%7B7*7%7D%7D"');
  });

  it("不影响文本管线的原始内容", () => {
    const page = createPage([{ tag: "text", header: `标题 ${raw}`, text: `正文 ${raw}` }]);
    const text = getPageText(page, "probe/text");

    expect(text).toContain(raw);
    expect(text).not.toContain("<!-- -->");
  });
});
