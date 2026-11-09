import { compile } from "@vue/compiler-dom";
import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";

const escapeHtml = (content: string): string =>
  content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** 复刻 VuePress 的 v-pre 行为，用于把 Markdown 渲染成 Vue 模板源 */
const markdownIt = new MarkdownIt({ html: true });
const defaultFence = markdownIt.renderer.rules.fence;

if (!defaultFence) throw new Error("markdown-it 缺少默认 fence 渲染器");

markdownIt.renderer.rules.fence = (tokens, index, options, env): string => {
  const token = tokens[index];

  if (token.info.includes(":no-v-pre")) token.info = token.info.replace(":no-v-pre", "");
  else token.attrSet("v-pre", "");

  return defaultFence(tokens, index, options, env, markdownIt.renderer);
};
markdownIt.renderer.rules.code_inline = (tokens, index): string =>
  `<code v-pre>${escapeHtml(tokens[index].content)}</code>`;

const compileTemplate = (markdown: string): string => {
  const html = markdownIt.render(markdown);
  const { code } = compile(html, { mode: "function" });

  return code;
};

const createPage = (content: PageConfig["content"], desc?: string): PageConfig => ({
  title: "t",
  ...(desc ? { desc } : {}),
  content,
});

describe("vue 编译级插值防护", () => {
  it("对照：未中和的正文会产生插值", () => {
    const code = compileTemplate("正文 {{ 7*7 }}");

    expect(code).toContain("_toDisplayString");
  });

  it("链接 destination 中的反引号吞掉正文", () => {
    const page = createPage([{ tag: "text", text: "[a](`){{7*7}}`" }], "[a](`){{7*7}}`");
    const code = compileTemplate(getPageMarkdown(page, { location: "probe/link-dest" }));

    expect(code).not.toContain("_toDisplayString");
  });

  it("嵌套 raw-text 与列表围栏不产生插值", () => {
    const desces = [
      '<div><textarea><div a="{{ 7*7 }}"></textarea></div>',
      '- <textarea><div a="{{ 7*7 }}"></textarea>',
      '- ``` text :no-v-pre\n  <div a="{{ 7*7 }}">\n  ```',
      '- ``` text :no-v-pre\n  <div a="{{ 7*7 }}">',
    ];

    for (const desc of desces) {
      const code = compileTemplate(
        getPageMarkdown(createPage([], desc), { location: "probe/nested-raw-text" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("表格单元格跨竖线配对反引号", () => {
    const page = createPage([
      { tag: "text", text: "| a` {{7*7}} | b` |\n| --- | --- |" },
      { tag: "table", caption: "c", header: ["h1", "h2"], body: [["a` {{7*7}}", "b`"]] },
    ]);
    const code = compileTemplate(getPageMarkdown(page, { location: "probe/table-cell" }));

    expect(code).not.toContain("_toDisplayString");
  });

  it("残缺链接中的反引号不会导致超时", () => {
    const desc = "[a](x(y`) {{7*7}}`";
    const startedAt = Date.now();
    const code = compileTemplate(
      getPageMarkdown(createPage([], desc), { location: "probe/link-timeout" }),
    );

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(code).not.toContain("_toDisplayString");
  });

  it("链接 destination 含花括号", () => {
    for (const desc of [
      "[a](`{ ) {{7*7}}`",
      "[a](`} ) {{7*7}}`",
      "[a](<`{>) {{7*7}}`",
      "[x]({{7*7}})",
    ]) {
      const page = createPage([], desc);
      const code = compileTemplate(getPageMarkdown(page, { location: "probe/link-brace" }));

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("链接 title 与 autolink 内的反引号", () => {
    for (const desc of ['[a](https://x "`") {{7*7}}', "<https://x/`> {{7*7}}"]) {
      const page = createPage([], desc);
      const code = compileTemplate(getPageMarkdown(page, { location: "probe/link-title" }));

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("无空格伪链接、autolink 文本与闭合标签属性不产生插值", () => {
    const payloads = [
      "x]({{7*7}})",
      "x <https://e.com/{{7*7}}>",
      "x <https://e.com/`{{7*7}}`>",
      "x <https://e.com/``{{7*7}}``>",
      'x </x a="{{7*7}}">',
    ];

    for (const desc of payloads) {
      const code = compileTemplate(
        getPageMarkdown(createPage([], desc), { location: "probe/round-10" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("伪 HTML 标签名与行首注释块中的插值", () => {
    const page = createPage(
      [
        { tag: "text", text: '前 <a_b title="{{ 7*7 }}"> 后' },
        { tag: "text", text: "<!-- 注释 {{ 7*7 }} 结束 -->" },
      ],
      '<!-- 描述 {{ 7*7 }} -->\n\n<!-->\n{{ 7*7 }}\n-->\n\n<!--->\n{{ 7*7 }}\n-->\n\n<a_b title="{{ 7*7 }}">',
    );
    const code = compileTemplate(getPageMarkdown(page, { location: "probe/html-block" }));

    expect(code).not.toContain("_toDisplayString");
  });

  it("废弃原始文本元素不会导致 Vue 编译错误", () => {
    const desces = [
      '<plaintext><div a="{{ 7*7 }}"></div>',
      '<plaintext><div a="{{ 7*7 }}"></div></plaintext>',
      '<listing><div a="{{ 7*7 }}"></div></listing>',
      '<noscript><div a="{{ 7*7 }}"></div></noscript>',
      '<template><div a="{{ 7*7 }}"></div></template>',
    ];

    for (const desc of desces) {
      const code = compileTemplate(
        getPageMarkdown(createPage([], desc), { location: "probe/obsolete-raw-text" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("可解码 autolink 与容器内缩进代码不产生插值", () => {
    const desces = [
      "<https://e/%7B%7B7*7%7D%7D>",
      "<a%7B%7B7*7%7D%7D@b.com>",
      "<a&#123;&#123;7*7&#125;&#125;@b.com>",
      "<a&lcub;&lcub;7*7&rcub;&rcub;@b.com>",
      "<https://e/&lcub;&lcub;7*7&rcub;&rcub;>",
      "`x <https://e/`> {{7*7}} `",
      "- >     `{{7*7}}`",
      "    {{7*7}}",
    ];

    for (const desc of desces) {
      const code = compileTemplate(
        getPageMarkdown(createPage([], desc), { location: "probe/decoded-autolink" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("列表缩进溢出与 :no-v-pre 围栏内不产生插值", () => {
    const payloads = [
      "-     ```js {{7*7}}",
      "-     ```js\n      {{7*7}}",
      "-\t\t```js {{7*7}}",
      "```md :no-v-pre\n- ```js {{7*7}}\n```",
      "```md :no-v-pre\n- ```js {{7*7}}",
      "~~~md :no-v-pre\n1. ```js {{7*7}}\n~~~",
      "- ```js :no-v-pre\n  ```js\n  {{7*7}}\n  ```",
      "1. ```js :no-v-pre\n   ```js {{7*7}}\n   ```",
      "- ```js :no-v-pre\n  ```js {{7*7}}",
    ];

    for (const text of payloads) {
      const markdown = getPageMarkdown(createPage([{ tag: "text", header: "h", text }]), {
        location: "oracle/list-indent",
      });
      const descMarkdown = getPageMarkdown(createPage([], text), {
        location: "oracle/list-indent-desc",
      });

      expect(markdown).not.toContain("{{");
      expect(descMarkdown).not.toContain("{{");
      expect(compileTemplate(markdown)).not.toContain("_toDisplayString");
      expect(compileTemplate(descMarkdown)).not.toContain("_toDisplayString");
    }
  });

  it("列表围栏缩进闭合行之后的段落不产生插值", () => {
    const payloads = [
      "- ```js\n  ```\n{{7*7}}",
      "- ```js\n  ```\n\n{{7*7}}",
      "- ```js :no-v-pre\n  ```\n{{7*7}}",
      "- item\n  - ```js\n    ```\n  {{7*7}}",
    ];

    for (const text of payloads) {
      const markdown = getPageMarkdown(createPage([{ tag: "text", header: "h", text }]), {
        location: "oracle/list-fence-close",
      });
      const descMarkdown = getPageMarkdown(createPage([], text), {
        location: "oracle/list-fence-close-desc",
      });

      expect(markdown).not.toContain("{{");
      expect(descMarkdown).not.toContain("{{");
      expect(compileTemplate(markdown)).not.toContain("_toDisplayString");
      expect(compileTemplate(descMarkdown)).not.toContain("_toDisplayString");
    }
  });

  it("列表续行围栏与相邻 :no-v-pre 围栏不产生插值", () => {
    const payloads = [
      "- item\n  ```js\n{{7*7}}",
      "- item\n  ~~~js\n{{7*7}}",
      "- ~~~js\n- ```md :no-v-pre\n  {{7*7}}",
    ];

    for (const text of payloads) {
      const markdown = getPageMarkdown(createPage([{ tag: "text", header: "h", text }]), {
        location: "oracle/list-continuation-fence",
      });
      const descMarkdown = getPageMarkdown(createPage([], text), {
        location: "oracle/list-continuation-fence-desc",
      });

      expect(markdown).not.toContain("{{");
      expect(descMarkdown).not.toContain("{{");
      expect(compileTemplate(markdown)).not.toContain("_toDisplayString");
      expect(compileTemplate(descMarkdown)).not.toContain("_toDisplayString");
    }
  });

  it("列表续行围栏的伪闭合与引用前缀 tab 不产生插值", () => {
    const textPayloads = [
      "- item\n  ```js\n{{7*7}}\n  ```",
      "- item\n  ~~~js\n{{7*7}}\n  ~~~",
      "- item\n  ````js\n{{7*7}}\n  ````",
      "1. item\n   ```js\n{{7*7}}\n   ```",
      "- item\n  ```js\n\n{{7*7}}\n  ```",
    ];
    const descPayloads = [...textPayloads, "1. ```js\n\t{{7*7}}", "10. ```js\n\t{{7*7}}"];

    for (const text of textPayloads) {
      const markdown = getPageMarkdown(createPage([{ tag: "text", header: "h", text }]), {
        location: "oracle/pseudo-close",
      });

      expect(markdown).not.toContain("{{");
      expect(compileTemplate(markdown)).not.toContain("_toDisplayString");
    }

    for (const desc of descPayloads) {
      const descMarkdown = getPageMarkdown(createPage([], desc), {
        location: "oracle/pseudo-close-desc",
      });

      expect(descMarkdown).not.toContain("{{");
      expect(compileTemplate(descMarkdown)).not.toContain("_toDisplayString");
    }
  });

  it("引用块与列表围栏边界外不产生插值", () => {
    const desces = [
      "> ```js\n> {{7*7}}\n> ```",
      "> > ```js\n> > {{7*7}}\n> > ```",
      "- ```js\n{{7*7}}\n```",
      "> - ```js\n>   {{7*7}}\n>   ```",
      "```js\n{{7*7}}\n```",
    ];

    for (const desc of desces) {
      const code = compileTemplate(
        getPageMarkdown(createPage([], desc), { location: "probe/container-fence" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }
  });

  it("行内与关闭 plaintext 标签不产生插值或编译错误", () => {
    const desces = [
      "前文 <plaintext> 后文 {{7*7}}",
      "</plaintext>",
      "`<textarea>` 与 `{{ 7 * 7 }}`",
    ];

    for (const desc of desces) {
      const markdown = getPageMarkdown(createPage([], desc), {
        location: "probe/inline-plaintext",
      });

      expect(() => compileTemplate(markdown)).not.toThrow();
      expect(compileTemplate(markdown)).not.toContain("_toDisplayString");
    }
  });

  it("跨行行内代码、转义反引号与列表围栏不产生插值", () => {
    const texts = ["`a\nb` {{7*7}}", "`\n`{{7*7}}", "\\``x`{{7*7}}`"];

    for (const text of texts) {
      const code = compileTemplate(
        getPageMarkdown(createPage([{ tag: "text", text }]), { location: "probe/multiline-code" }),
      );

      expect(code).not.toContain("_toDisplayString");
    }

    const fence = compileTemplate(
      getPageMarkdown(createPage([], "- ```js\n  {{7*7}}\n  ```"), {
        location: "probe/list-fence",
      }),
    );

    expect(fence).not.toContain("_toDisplayString");
    expect(fence).toContain("{{7*7}}");
  });

  it("crlf 围栏代码由 v-pre 保护", () => {
    const page = createPage([{ tag: "text", text: "```\r\n{{ 7*7 }}\r\n```" }]);
    const code = compileTemplate(getPageMarkdown(page, { location: "probe/crlf-fence" }));

    expect(code).not.toContain("_toDisplayString");
  });
});
