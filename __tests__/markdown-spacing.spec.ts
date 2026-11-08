import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

// 判断目标行是否仍位于 HTML block 内。
// 按 CommonMark 的简化规则：整行的 HTML 开始标签会进入 HTML block，直到空行结束。
const isInsideHtmlBlock = (markdown: string, targetLine: string): boolean => {
  let inHtmlBlock = false;

  for (const line of markdown.split("\n")) {
    if (inHtmlBlock) {
      if (line.trim() === "") inHtmlBlock = false;
      else if (line === targetLine) return true;
    } else if (/^<\/?[\w-]+(?:\s[^>]*)?>$/u.test(line.trim())) {
      inHtmlBlock = true;
    }
  }

  return false;
};

describe(getPageMarkdown, () => {
  it("card 的 <a> 分支与后续组件之间恰好保留一个空行", () => {
    const page = {
      title: "测试页面",
      content: [
        { tag: "card", title: "校园卡", desc: "校园卡说明", url: "card-url" },
        { tag: "title", text: "标题组件" },
        { tag: "text", text: ["正文第一段", "正文第二段"] },
      ],
    } as unknown as PageConfig;

    const markdown = getPageMarkdown(page, {
      location: "guide/card",
      urlConverter: (url) => `https://example.com/${url}`,
    });

    expect(markdown).toContain('<a class="innenu-card"');
    // 卡片 HTML block 与标题之间恰好一个空行，标题会单独占一行
    expect(markdown).toContain("</a>\n\n## 标题组件");
    expect(markdown).toContain("## 标题组件\n\n正文第一段");
    // 后续组件不应被吞进 card 的 HTML block
    expect(isInsideHtmlBlock(markdown, "## 标题组件")).toBe(false);
    expect(isInsideHtmlBlock(markdown, "正文第一段")).toBe(false);
    // 不存在三连空行，且整篇 Markdown 以单个换行结尾
    expect(markdown).not.toContain("\n\n\n");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("card 的 <RouteLink> 分支同样与后续组件保持一个空行", () => {
    const page = {
      title: "测试页面",
      content: [
        { tag: "card", title: "校园卡", desc: "校园卡说明", path: "guide/card" },
        { tag: "title", text: "标题组件" },
        { tag: "text", text: ["正文第一段", "正文第二段"] },
      ],
    } as unknown as PageConfig;

    const markdown = getPageMarkdown(page, { location: "guide/card" });

    expect(markdown).toContain('<RouteLink class="innenu-card"');
    expect(markdown).toContain("</RouteLink>\n\n## 标题组件");
    expect(markdown).toContain("## 标题组件\n\n正文第一段");
    expect(markdown).not.toContain("\n\n\n");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("以换行开头的组件块不会产生三连空行", () => {
    const page = {
      title: "文档页面",
      content: [
        { tag: "doc", name: "招生简章", url: "https://example.com/guide.pdf" },
        { tag: "title", text: "标题组件" },
        { tag: "text", text: "正文第一段" },
      ],
    } as unknown as PageConfig;

    const markdown = getPageMarkdown(page, { location: "guide/doc" });

    expect(markdown).toContain("</a>\n\n## 标题组件");
    expect(markdown).not.toContain("\n\n\n");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("desc 作为独立块输出，且空内容仍保留 frontmatter 后的空行", () => {
    const page = {
      title: "测试页面",
      desc: "第一行\n第二行",
      content: [
        { tag: "title", text: "标题组件" },
        { tag: "text", text: "仅小程序展示", env: ["wx"] },
      ],
    } as unknown as PageConfig;

    const markdown = getPageMarkdown(page, { location: "guide/desc" });

    expect(markdown).toBe(
      "---\ntitle: 测试页面\nisOriginal: true\n---\n\n## 标题组件\n\n> 第一行\n>\n> 第二行\n",
    );
  });

  it("所有组件都被 env 过滤时保留原有空内容行为", () => {
    const page = {
      title: "空页面",
      content: [{ tag: "title", text: "仅小程序展示", env: ["wx"] }],
    } as unknown as PageConfig;

    const markdown = getPageMarkdown(page, { location: "guide/empty" });

    expect(markdown).toBe("---\ntitle: 空页面\nisOriginal: true\n---\n\n");
  });
});

describe(getPageText, () => {
  it("卡片与标题、正文之间恰好保留一个空行", () => {
    const page = {
      title: "测试页面",
      content: [
        { tag: "card", title: "校园卡", desc: "校园卡说明", url: "card-url" },
        { tag: "title", text: "标题组件" },
        { tag: "text", text: ["正文第一段", "正文第二段"] },
      ],
    } as unknown as PageConfig;

    const text = getPageText(page, "guide/card", {
      urlConverter: (url) => ({
        miniapp: `/pages/${url}`,
        web: `https://example.com/${url}`,
      }),
    });

    expect(text).toContain("[网页版](https://example.com/card-url)）\n\n## 标题组件");
    expect(text).toContain("正文第一段\n\n正文第二段");
    expect(text).toContain("## 标题组件\n\n正文第一段");
    expect(text).not.toContain("\n\n\n");
  });
});
