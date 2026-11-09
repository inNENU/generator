// oxlint-disable no-script-url -- 安全测试需要构造危险协议样本
import { describe, expect, it, vi } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const createPage = (content: PageConfig["content"]): PageConfig => ({
  title: "URL 安全测试",
  desc: "验证链接协议过滤",
  content,
});

const renderSite = (content: PageConfig["content"]): string =>
  getPageMarkdown(createPage(content), {
    location: "test/url",
    urlConverter: (url) => (url.startsWith("web?url=") ? url.slice(8) : null),
  });

// 故意构造不满足 schema 的危险地址，避免校验日志干扰测试输出。
vi.spyOn(console, "error").mockImplementation(() => {});

describe("站点 Markdown URL 协议过滤", () => {
  it("list 丢弃危险转换结果并保留安全、相对与裸文本条目", () => {
    const markdown = renderSite([
      {
        tag: "list",
        header: "列表",
        items: [
          { text: "危险列表项", url: "web?url=javascript:alert(1)" },
          { text: "安全列表项", url: "web?url=https://example.com/list" },
          { text: "相对列表项", url: "web?url=/pages/list" },
          { text: "普通列表项" },
        ],
      },
    ]);

    expect(markdown).not.toContain('href="javascript:');
    expect(markdown).not.toContain('href="data:');
    expect(markdown).not.toContain("危险列表项");
    expect(markdown).toContain("普通列表项");
    expect(markdown).toContain(
      '<a class="innenu-list-item" href="https://example.com/list" target="_blank">',
    );
    expect(markdown).toContain('<RouteLink class="innenu-list-item" to="/pages/list">');
  });

  it("grid 与 card 丢弃危险转换结果并保留安全、相对与锚点地址", () => {
    const markdown = renderSite([
      {
        tag: "grid",
        header: "网格",
        items: [
          { icon: "icon-danger", text: "危险网格项", url: "web?url=JaVaScRiPt:alert(1)" },
          { icon: "icon-safe", text: "安全网格项", url: "web?url=https://example.com/grid" },
          { icon: "icon-relative", text: "相对网格项", url: "web?url=pages/grid" },
        ],
      },
      { tag: "card", title: "危险卡片", url: "web?url=data:text/html,<script>alert(1)</script>" },
      { tag: "card", title: "安全卡片", url: "web?url=https://example.com/card" },
      { tag: "card", title: "锚点卡片", url: "web?url=#card" },
    ]);

    expect(markdown).not.toContain('href="javascript:');
    expect(markdown).not.toContain('href="data:');
    expect(markdown).not.toContain("危险网格项");
    expect(markdown).not.toContain("危险卡片");
    expect(markdown).toContain(
      '<a class="innenu-grid-item" href="https://example.com/grid" target="_blank">',
    );
    expect(markdown).toContain('<a class="innenu-grid-item" href="pages/grid" target="_blank">');
    expect(markdown).toContain(
      '<a class="innenu-card" href="https://example.com/card" target="_blank">',
    );
    expect(markdown).toContain('<a class="innenu-card" href="#card" target="_blank">');
  });

  it("action 的危险协议回退为纯文本代码块，合法链接保持可点击", () => {
    const convertedUrls: Record<string, string> = {
      danger: "javascript:alert(1)",
      mixed: " JaVaScRiPt:alert(1)",
      safe: "https://example.com/action",
    };
    const markdown = getPageMarkdown(
      createPage([
        { tag: "action", header: "危险操作", content: "danger" },
        { tag: "action", header: "混合大小写操作", content: "mixed" },
        { tag: "action", header: "安全操作", content: "safe" },
        { tag: "action", header: "原始危险地址", content: "javascript:alert(1)" },
      ]),
      {
        location: "test/url",
        urlConverter: (url) => convertedUrls[url],
      },
    );

    expect(markdown).not.toContain("](javascript:");
    expect(markdown).not.toContain("]( JaVaScRiPt:");
    expect(markdown).toContain("```text\njavascript:alert(1)\n```");
    expect(markdown).toContain("[安全操作](https://example.com/action)");
  });

  it("text 组件的 article/path 详情链接拒绝危险协议", () => {
    const markdown = renderSite([
      {
        tag: "text",
        header: "危险详情",
        text: "正文",
        action: "article",
        url: "javascript:alert(1)",
      },
      {
        tag: "text",
        header: "安全详情",
        text: "正文",
        action: "article",
        url: "https://example.com/details",
      },
      { tag: "text", header: "相对详情", text: "正文", path: "/pages/details" },
    ]);

    expect(markdown).not.toContain("[查看详情](javascript:");
    expect(markdown).not.toContain("危险详情\n\n- [查看详情]");
    expect(markdown).toContain("- [查看详情](https://example.com/details)");
    expect(markdown).toContain("- [查看详情](/pages/details.md)");
  });

  it("doc 与 img 不输出危险协议", () => {
    const markdown = renderSite([
      { tag: "doc", name: "危险文档", url: "javascript:alert(1)" },
      { tag: "doc", name: "安全文档", url: "https://example.com/safe.pdf" },
      { tag: "img", src: "javascript:alert(1)", desc: "危险图片" },
      { tag: "img", src: "https://example.com/safe.png", desc: "安全图片" },
    ]);

    expect(markdown).not.toContain('href="javascript:');
    expect(markdown).not.toContain('src="javascript:');
    expect(markdown).not.toContain("![危险图片]");
    expect(markdown).toContain('<span class="innenu-doc">');
    expect(markdown).toContain("危险文档");
    expect(markdown).toContain('href="https://example.com/safe.pdf"');
    expect(markdown).toContain('src="https://example.com/safe.png"');
  });

  it("carousel/account/phone 不输出危险协议", () => {
    const markdown = renderSite([
      { tag: "carousel", images: ["javascript:alert(1)", "https://example.com/one.png"] },
      {
        tag: "account",
        name: "测试账号",
        logo: "javascript:alert(1)",
        site: "javascript:alert(1)",
        mail: "test@example.com",
      },
      {
        tag: "phone",
        header: "危险电话",
        fName: "老师",
        num: "javascript:alert(1)",
        site: "javascript:alert(1)",
        mail: "test@example.com",
      },
    ]);

    expect(markdown).not.toContain('href="javascript:');
    expect(markdown).not.toContain('src="javascript:');
    expect(markdown).not.toContain("tel:javascript:");
    expect(markdown).toContain("![''](https://example.com/one.png)");
    expect(markdown).toContain("危险电话");
    expect(markdown).toContain('href="mailto:test@example.com"');
  });
});

describe("文本 Markdown URL 协议过滤", () => {
  it("丢弃危险转换结果，保留安全与相对链接", () => {
    const convertedUrls: Record<string, { miniapp: string; web: string }> = {
      danger: { miniapp: "javascript:alert(1)", web: "javascript:alert(1)" },
      safe: { miniapp: "/pages/safe", web: "https://example.com/safe" },
      relative: { miniapp: "/pages/relative", web: "/pages/relative" },
    };
    const text = getPageText(
      createPage([
        {
          tag: "list",
          header: "列表",
          items: [
            { text: "危险列表项", url: "danger" },
            { text: "安全列表项", url: "safe" },
            { text: "相对列表项", url: "relative" },
          ],
        },
        { tag: "card", title: "危险卡片", url: "danger" },
        { tag: "doc", name: "危险文档", url: "javascript:alert(1)" },
        { tag: "action", header: "危险操作", content: "danger" },
      ]),
      "test/url",
      { urlConverter: (url) => convertedUrls[url] },
    );

    expect(text).not.toContain("](javascript:");
    expect(text).not.toContain("危险列表项");
    expect(text).not.toContain("危险卡片");
    expect(text).toContain(
      "- 安全列表项（小程序：`/pages/safe`，[网页版](https://example.com/safe)）",
    );
    expect(text).toContain("- 相对列表项（小程序：`/pages/relative`，[网页版](/pages/relative)）");
    expect(text).toContain("- 危险文档\n");
    expect(text).not.toContain("[危险文档](javascript:");
    expect(text).toContain("```text\njavascript:alert(1)\n```");
  });
});
