// oxlint-disable no-script-url -- 安全测试需要构造危险协议样本
import MarkdownIt from "markdown-it";
import { describe, expect, it, vi } from "vitest";

import { getTextMarkdown } from "../src/components/text/markdown.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";
import { escapeMarkdownLinkLabel, formatMarkdownDestination } from "../src/utils.js";

const md = new MarkdownIt();

interface ParsedMedia {
  type: "image" | "link";
  href: string;
  /** 链接文字；图片为 Markdown 源中的 alt 原文 */
  text: string;
}

/**
 * 取出顶层 inline token 的子 token
 *
 * @param markdown Markdown 内容
 * @returns Inline 子 token 列表
 */
const getInlineTokens = (markdown: string): ReturnType<typeof md.parse>[number]["children"] =>
  md
    .parse(markdown, {})
    .flatMap((token) => (token.type === "inline" ? (token.children ?? []) : []));

/**
 * 解析 Markdown 中的链接与图片
 *
 * @param markdown Markdown 内容
 * @returns 链接与图片列表
 */
const parseMedia = (markdown: string): ParsedMedia[] => {
  const tokens = getInlineTokens(markdown) ?? [];
  const media: ParsedMedia[] = [];

  tokens.forEach((token, index) => {
    if (token.type === "image") {
      media.push({ type: "image", href: String(token.attrGet("src") ?? ""), text: token.content });

      return;
    }

    if (token.type !== "link_open") return;

    let text = "";

    for (
      let cursor = index + 1;
      cursor < tokens.length && tokens[cursor].type !== "link_close";
      cursor += 1
    )
      text += tokens[cursor].content;

    media.push({ type: "link", href: String(token.attrGet("href") ?? ""), text });
  });

  return media;
};

/**
 * 取出链接 / 图片之外的正文，用于确认没有内容泄漏到链接外
 *
 * @param markdown Markdown 内容
 * @returns 链接与图片之外的正文
 */
const getTextOutsideMedia = (markdown: string): string => {
  let depth = 0;
  let text = "";

  for (const token of getInlineTokens(markdown) ?? []) {
    if (token.type === "link_open") depth += 1;
    else if (token.type === "link_close") depth -= 1;
    else if (depth === 0 && token.type === "text") text += token.content;
  }

  return text;
};

const createPage = (content: PageConfig["content"]): PageConfig => ({
  title: "链接转义测试",
  desc: "",
  content,
});

const renderText = (
  content: PageConfig["content"],
  options: Parameters<typeof getPageText>[2] = {},
): string => getPageText(createPage(content), "test/link", options);

const renderSite = (content: PageConfig["content"]): string =>
  getPageMarkdown(createPage(content), { location: "test/link" });

/**
 * 取出生成的“查看详情”行
 *
 * @param markdown Markdown 内容
 * @returns “查看详情”行
 */
const getActionLine = (markdown: string): string => {
  const line = markdown.split("\n").find((item) => item.startsWith("- [查看详情]"));

  if (!line) throw new Error("未找到“查看详情”链接");

  return line;
};

// 故意构造不满足 schema 的地址（含括号 / 空格），避免校验日志干扰测试输出。
vi.spyOn(console, "error").mockImplementation(() => {});

describe(formatMarkdownDestination, () => {
  it.each([
    "https://example.com/plain.png",
    "https://example.com/a(b).png",
    "https://example.com/?a=1&b=2",
    "https://example.com/a%20b.png",
    "tel:0431-85099999",
    "mailto:foo@example.com",
    "../guide/README.md",
  ])("普通地址 %s 逐字节保持不变", (url) => {
    expect(formatMarkdownDestination(url)).toBe(url);
  });

  it("空白、尖括号与不成对括号使用尖括号包裹", () => {
    expect(formatMarkdownDestination("https://example.com/a b.png")).toBe(
      "<https://example.com/a b.png>",
    );
    expect(formatMarkdownDestination("https://example.com/x)a")).toBe("<https://example.com/x)a>");
    expect(formatMarkdownDestination("https://example.com/a<b>.png")).toBe(
      "<https://example.com/a&lt;b&gt;.png>",
    );
  });

  it("控制字符与反斜杠做百分号编码，链接不跨行", () => {
    const destination = formatMarkdownDestination("https://example.com/a\nb\tc\\d.png");
    const line = `[文件](${destination})`;

    expect(destination).toBe("https://example.com/a%0Ab%09c%5Cd.png");
    expect(line).not.toMatch(/[\n\t\\]/u);
    expect(parseMedia(line)).toStrictEqual([
      { type: "link", href: "https://example.com/a%0Ab%09c%5Cd.png", text: "文件" },
    ]);
  });

  it("裸目标中的 HTML 字符引用被固定", () => {
    expect(formatMarkdownDestination("https://example.com/?a=1&copy;=2")).toBe(
      "https://example.com/?a=1%26copy;=2",
    );
    expect(formatMarkdownDestination("https://example.com/?a=1&b=2")).toBe(
      "https://example.com/?a=1&b=2",
    );
  });

  it.each([
    ["https://example.com/a b.png", "https://example.com/a%20b.png"],
    ["https://example.com/x)a", "https://example.com/x)a"],
    ["https://example.com/a(b.png", "https://example.com/a(b.png"],
    ["https://example.com/a(b).png", "https://example.com/a(b).png"],
  ])("地址 %s 渲染为单个链接", (url, href) => {
    const line = `[文件](${formatMarkdownDestination(url)})`;

    expect(parseMedia(line)).toStrictEqual([{ type: "link", href, text: "文件" }]);
    expect(getTextOutsideMedia(line)).toBe("");
  });
});

describe(escapeMarkdownLinkLabel, () => {
  it("转义反斜杠与方括号", () => {
    expect(escapeMarkdownLinkLabel("a]b")).toBe(String.raw`a\]b`);
    expect(escapeMarkdownLinkLabel("[a]")).toBe(String.raw`\[a\]`);
    expect(escapeMarkdownLinkLabel(String.raw`a\b`)).toBe(String.raw`a\\b`);
    expect(escapeMarkdownLinkLabel("普通文字")).toBe("普通文字");
  });

  it("渲染后链接文字保持原样", () => {
    const label = escapeMarkdownLinkLabel(String.raw`a]b [c] \d`);

    expect(parseMedia(`[${label}](https://example.com/)`)).toStrictEqual([
      { type: "link", href: "https://example.com/", text: String.raw`a]b [c] \d` },
    ]);
  });
});

describe("text 组件 action 链接（文本 dialect）", () => {
  it.each(["a)b(c", "x&y=z", "张三 (NENU)", "a b", "a#b", "a=b&c=d"])(
    "official 用户名 %s 只保留一个 username 参数",
    (username) => {
      const line = getActionLine(
        getTextMarkdown({ tag: "text", text: "正文", action: "official", username }),
      );

      expect(parseMedia(line)).toHaveLength(1);

      const [media] = parseMedia(line);
      const url = new URL(media.href);

      expect(url.searchParams.size).toBe(1);
      expect(url.searchParams.get("username")).toBe(username);
      expect(getTextOutsideMedia(line)).toBe("");
    },
  );

  it.each([
    ["https://mp.weixin.qq.com/s/x)a", "https://mp.weixin.qq.com/s/x)a"],
    ["https://mp.weixin.qq.com/s/a b", "https://mp.weixin.qq.com/s/a%20b"],
  ])("article 地址 %s 渲染为单个链接", (url, href) => {
    const line = getActionLine(
      getTextMarkdown({ tag: "text", text: "正文", action: "article", url }),
    );

    expect(parseMedia(line)).toStrictEqual([{ type: "link", href, text: "查看详情" }]);
    expect(getTextOutsideMedia(line)).toBe("");
  });

  it("article 危险协议仍被丢弃", () => {
    const text = getTextMarkdown({
      tag: "text",
      text: "危险正文",
      action: "article",
      url: "javascript:alert(1)",
    });

    expect(text).not.toContain("[查看详情]");
    expect(text).toContain("危险正文");
  });
});

describe("文本管线图片、文档与音视频链接", () => {
  it("含括号、空格时仍是单个链接 / 图片", () => {
    const text = renderText([
      { tag: "img", src: "https://example.com/tu (1).png", desc: String.raw`图]片` },
      {
        tag: "carousel",
        images: ["https://example.com/a)b.png", "https://example.com/c (1).png"],
      },
      { tag: "doc", name: "a]b", url: "https://example.com/a)b.pdf" },
      { tag: "audio", src: "https://example.com/a (1).mp3", name: String.raw`录]音` },
      { tag: "video", src: "https://example.com/a (1).mp4", title: String.raw`视]频` },
    ]);
    const media = parseMedia(text);

    expect(media).toStrictEqual([
      {
        type: "image",
        href: "https://example.com/tu%20(1).png",
        text: String.raw`图\]片`,
      },
      { type: "image", href: "https://example.com/a)b.png", text: "''" },
      { type: "image", href: "https://example.com/c%20(1).png", text: "''" },
      { type: "link", href: "https://example.com/a)b.pdf", text: "a]b.pdf" },
      { type: "link", href: "https://example.com/a%20(1).mp3", text: "音频: 录]音" },
      { type: "link", href: "https://example.com/a%20(1).mp4", text: "视频: 视]频" },
    ]);
    // 除标题外不应有内容泄漏到链接 / 图片之外
    expect(getTextOutsideMedia(text)).toBe("链接转义测试");
  });

  it("图片渲染后的 alt 文字保持原样", () => {
    const html = md.render(
      renderText([{ tag: "img", src: "https://example.com/tu.png", desc: String.raw`图]片` }]),
    );

    expect(html).toContain('alt="图]片"');
  });

  it("普通地址输出保持原样", () => {
    const text = renderText([
      { tag: "img", src: "https://example.com/plain.png", desc: "图片" },
      { tag: "doc", name: "文档", url: "https://example.com/plain.pdf" },
    ]);

    expect(text).toContain("![图片](https://example.com/plain.png)");
    expect(text).toContain("- [文档.pdf](https://example.com/plain.pdf)");
  });

  it("list / card 的网页版地址同样转义", () => {
    const text = renderText(
      [
        { tag: "list", items: [{ text: "条目", url: "with-specials" }] },
        { tag: "card", title: "卡片", url: "with-specials" },
      ],
      {
        urlConverter: () => ({
          miniapp: "/pages/safe",
          web: "https://example.com/a (1)",
        }),
      },
    );
    const media = parseMedia(text);

    expect(media).toStrictEqual([
      { type: "link", href: "https://example.com/a%20(1)", text: "网页版" },
      { type: "link", href: "https://example.com/a%20(1)", text: "网页版" },
    ]);
  });
});

describe("站点管线链接", () => {
  it("text 组件的 official / article 链接转义", () => {
    const markdown = renderSite([
      { tag: "text", text: "正文", action: "official", username: "a)b(c" },
      {
        tag: "text",
        text: "正文",
        action: "article",
        url: "https://mp.weixin.qq.com/s/x)a",
      },
    ]);
    const lines = markdown.split("\n").filter((line) => line.startsWith("- [查看详情]"));

    expect(lines).toHaveLength(2);
    expect(parseMedia(lines[0])[0].href).toContain("username=a%29b%28c");
    expect(parseMedia(lines[1])).toStrictEqual([
      {
        type: "link",
        href: "https://mp.weixin.qq.com/s/x)a",
        text: "查看详情",
      },
    ]);
    expect(getTextOutsideMedia(lines[1])).toBe("");
  });

  it("carousel 与 action 链接转义", () => {
    const markdown = renderSite([
      { tag: "carousel", images: ["https://example.com/a)b.png"] },
      { tag: "action", header: "下载", content: "https://example.com/a)b.pdf" },
    ]);
    const media = parseMedia(markdown);

    expect(media).toStrictEqual([
      { type: "image", href: "https://example.com/a)b.png", text: "''" },
      { type: "link", href: "https://example.com/a)b.pdf", text: "下载" },
    ]);
  });

  it("危险协议仍被拒绝", () => {
    const markdown = renderSite([
      { tag: "carousel", images: ["javascript:alert(1)"] },
      { tag: "action", header: "危险", content: "javascript:alert(1)" },
      { tag: "text", text: "正文", action: "article", url: "javascript:alert(1)" },
    ]);

    expect(markdown).not.toContain("](javascript:");
    expect(markdown).not.toContain("[查看详情](javascript:");
  });
});
