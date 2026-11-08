import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const createPage = (content: PageConfig["content"]): PageConfig => ({
  title: "测试页面",
  content,
});

// 站点管线的 URL 转换器返回单一网页地址；文本管线返回双端地址。
const pageUrlConverter = (url: string): string | null =>
  url.startsWith("site://") ? `https://example.com/${url.slice(7)}` : null;

const textUrlConverter = (url: string): { miniapp: string; web: string } | null => {
  if (!url.startsWith("site://")) return null;

  const target = url.slice(7);

  return { miniapp: `/pages/${target}`, web: `https://example.com/${target}` };
};

describe("page markdown parity", () => {
  it("table 组件在两条管线中输出完全一致", () => {
    const page = createPage([
      {
        tag: "table",
        caption: "招生计划",
        header: ["项目", "人数"],
        body: [["本科", "100"]],
      },
    ]);

    const markdown = getPageMarkdown(page, { location: "guide/table" });
    const text = getPageText(page, "guide/table");
    const table = "### 招生计划\n\n| 项目 | 人数 |\n| :-: | :-: |\n| 本科 | 100 |";

    expect(markdown).toContain(table);
    expect(text).toContain(table);
  });

  it("action 组件在 web 模式下使用相同的转换后链接", () => {
    const page = createPage([{ tag: "action", header: "报名", content: "site://signup" }]);

    const markdown = getPageMarkdown(page, {
      location: "guide/action",
      urlConverter: pageUrlConverter,
    });
    const text = getPageText(page, "guide/action", { urlConverter: textUrlConverter });

    expect(markdown).toContain("#### 报名");
    expect(text).toContain("#### 报名");
    expect(markdown).toContain("[报名](https://example.com/signup)");
    expect(text).toContain("[报名](https://example.com/signup)");
    expect(text).not.toContain("::: action");
  });

  it("普通文本在两条管线中都转义 HTML 并保留标题层级", () => {
    const page = createPage([
      { tag: "text", header: "提示", text: ['<script>alert("x")</script> & more'] },
    ]);

    const markdown = getPageMarkdown(page, { location: "guide/text" });
    const text = getPageText(page, "guide/text");

    expect(markdown).toContain("### 提示");
    expect(text).toContain("### 提示");
    expect(markdown).toContain("&lt;script&gt;");
    expect(text).toContain("&lt;script&gt;");
    expect(markdown).not.toContain("<script>");
    expect(text).not.toContain("<script>");
  });

  it("doc 组件共享文档显示名，但使用各自管线的链接形式", () => {
    const page = createPage([
      { tag: "doc", name: "招生简章", url: "https://example.com/files/guide.pdf" },
    ]);

    const markdown = getPageMarkdown(page, { location: "guide/doc" });
    const text = getPageText(page, "guide/doc");

    expect(markdown).toContain('class="innenu-doc"');
    expect(markdown).toContain("招生简章.pdf");
    expect(text).toContain("- [招生简章.pdf](https://example.com/files/guide.pdf)");
  });

  it("list 与 card 组件保留各自的展示形式，但转义规则一致", () => {
    const page = createPage([
      { tag: "list", header: "相关链接", items: [{ text: "A & B", url: "site://list" }] },
      { tag: "card", title: "C < D", desc: "说明", url: "site://card" },
    ]);

    const markdown = getPageMarkdown(page, {
      location: "guide/cards",
      urlConverter: pageUrlConverter,
    });
    const text = getPageText(page, "guide/cards", { urlConverter: textUrlConverter });

    // 站点管线输出 HTML 卡片；文本管线输出列表项，供知识库检索。
    expect(markdown).toContain('<div class="innenu-list');
    expect(text).toContain("- A &amp; B");
    expect(markdown).toContain("A &amp; B");
    expect(text).toContain("A &amp; B");
    expect(markdown).toContain("C &lt; D");
    expect(text).toContain("C &lt; D");
  });

  it("同一页面中的标题、文本、action 与 table 片段保持一致", () => {
    const page = createPage([
      { tag: "title", text: "标题" },
      { tag: "text", text: ["正文 <tag> & more"] },
      { tag: "doc", name: "招生简章", url: "https://example.com/files/guide.pdf" },
      { tag: "list", items: [{ text: "列表", url: "site://list" }] },
      { tag: "card", title: "卡片", desc: "说明", url: "site://card" },
      { tag: "action", header: "报名", content: "site://signup" },
      { tag: "table", header: ["列"], body: [["值"]] },
    ]);

    const markdown = getPageMarkdown(page, {
      location: "guide/mixed",
      urlConverter: pageUrlConverter,
    });
    const text = getPageText(page, "guide/mixed", { urlConverter: textUrlConverter });

    // doc / list / card 的展示形式按管线设计不同，这里只断言共享片段。
    expect(markdown).toContain("## 标题");
    expect(text).toContain("## 标题");
    expect(markdown).toContain("正文 &lt;tag&gt; &amp; more");
    expect(text).toContain("正文 &lt;tag&gt; &amp; more");
    expect(markdown).toContain("[报名](https://example.com/signup)");
    expect(text).toContain("[报名](https://example.com/signup)");
    expect(markdown).toContain("| 列 |\n| :-: |\n| 值 |");
    expect(text).toContain("| 列 |\n| :-: |\n| 值 |");
  });

  it("carousel 目前仅文本管线输出图片", () => {
    const page = createPage([
      { tag: "carousel", images: ["https://example.com/a.png", "https://example.com/b.png"] },
    ]);

    const markdown = getPageMarkdown(page, { location: "guide/carousel" });
    const text = getPageText(page, "guide/carousel");

    // 站点端还没有 carousel 渲染器，暂不输出；文本管线为知识库保留图片链接。
    expect(text).toContain("![''](https://example.com/a.png)");
    expect(text).toContain("![''](https://example.com/b.png)");
    expect(markdown).not.toContain("https://example.com/a.png");
  });
});
