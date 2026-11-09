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

  it("crlf 围栏代码由 v-pre 保护", () => {
    const page = createPage([{ tag: "text", text: "```\r\n{{ 7*7 }}\r\n```" }]);
    const code = compileTemplate(getPageMarkdown(page, { location: "probe/crlf-fence" }));

    expect(code).not.toContain("_toDisplayString");
  });
});
