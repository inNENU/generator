import { describe, expect, it, vi } from "vitest";

import {
  escapeMarkdownLinkLabel,
  formatMarkdownDestination,
  getPageMarkdown,
  getPageText,
} from "../src/index.js";
import type { PageConfig } from "../src/page/schema.js";

/** 会截断 Markdown 目标地址并注入 raw HTML 的样本 */
const payload = "https://example.com/a) <img src=x onerror=alert(1)>";

/**
 * 构造最小页面
 *
 * @param content 页面组件
 * @returns 页面配置
 */
const createPage = (content: PageConfig["content"]): PageConfig => ({ title: "注入测试", content });

/** 带尖括号的目标地址（恶意 URL 必须整体作为一个目标地址） */
const wrappedPayload = "<https://example.com/a) %3Cimg src=x onerror=alert(1)%3E>";

// 故意构造不满足 schema 的样本，避免校验日志干扰测试输出。
vi.spyOn(console, "error").mockImplementation(() => {});

describe("markdown 目标地址格式化", () => {
  it.each([
    ["https://example.com/a", "https://example.com/a"],
    ["/pages/list", "/pages/list"],
    ["https://example.com/a b", "<https://example.com/a b>"],
    ["https://example.com/a(b)", "<https://example.com/a(b)>"],
    ["https://example.com/a<b", "https://example.com/a%3Cb"],
    ["https://example.com/a>b", "https://example.com/a%3Eb"],
    [String.raw`https://example.com/a\b`, "https://example.com/a%5Cb"],
    ["https://example.com/a\nb", "https://example.com/a%0Ab"],
    ["", ""],
  ])("格式化目标地址 %j", (destination, expected) => {
    expect(formatMarkdownDestination(destination)).toBe(expected);
  });

  it("转义链接文字中的方括号、反斜杠与换行", () => {
    expect(escapeMarkdownLinkLabel(String.raw`a]b[c\d`)).toBe(String.raw`a\]b\[c\\d`);
    expect(escapeMarkdownLinkLabel("第一行\n第二行")).toBe("第一行 第二行");
  });
});

describe("站点 Markdown destination 注入", () => {
  it("carousel 的恶意图片地址被整体包成单一目标地址", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "carousel", images: [payload] }]), {
      check: true,
      location: "test/carousel",
    });

    expect(markdown).toContain(`![''](${wrappedPayload})`);
    expect(markdown).not.toContain("![''](https://example.com/a) <img");
    expect(markdown).not.toMatch(/<img src=x/u);
    expect(markdown.split("](<")).toHaveLength(2);
  });

  it("img 的 HTML 属性保持转义", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "img", src: payload, desc: "图]片[1]" }]), {
      location: "test/img",
    });

    expect(markdown).toContain('src="https://example.com/a) &lt;img src=x onerror=alert(1)&gt;"');
    expect(markdown).toContain('alt="图]片[1]"');
    expect(markdown).not.toMatch(/<img src=x/u);
  });

  it("action 的转换地址被整体包成单一目标地址", () => {
    const markdown = getPageMarkdown(
      createPage([{ tag: "action", header: "操作]", content: "danger" }]),
      { location: "test/action", urlConverter: () => payload },
    );

    expect(markdown).toContain(String.raw`[操作\]](${wrappedPayload})`);
    expect(markdown).not.toMatch(/<img src=x/u);
  });
});

describe("文本 Markdown destination 注入", () => {
  it("list/card 的网页版链接被整体包成单一目标地址", () => {
    const converted = { miniapp: "/pages/danger", web: payload };
    const text = getPageText(
      createPage([
        { tag: "list", items: [{ text: "条目", url: "danger" }] },
        { tag: "card", title: "卡片", url: "danger" },
      ]),
      "test/list",
      { urlConverter: () => converted },
    );

    expect(text.split("[网页版](<")).toHaveLength(3);
    expect(text).toContain(`[网页版](${wrappedPayload})`);
    expect(text).not.toMatch(/<img src=x/u);
  });

  it("img/carousel/audio/video 不留 raw HTML", () => {
    const text = getPageText(
      createPage([
        { tag: "img", src: payload, desc: "图]片" },
        { tag: "carousel", images: [payload] },
        { tag: "audio", src: payload, name: "录]音" },
        { tag: "video", src: payload, title: "视]频" },
      ]),
      "test/media",
    );

    expect(text).toContain(String.raw`![图\]片](${wrappedPayload})`);
    expect(text).toContain(`![''](${wrappedPayload})`);
    expect(text).toContain(String.raw`[音频: 录\]音](${wrappedPayload})`);
    expect(text).toContain(String.raw`[视频: 视\]频](${wrappedPayload})`);
    expect(text).not.toMatch(/<img src=x/u);
  });

  it("account 的 logo、二维码、邮箱与网站不产生注入", () => {
    const text = getPageText(
      createPage([
        {
          tag: "account",
          name: "账]号",
          logo: payload,
          wxid: "innenu&x=1",
          mail: "a]b@example.com",
          site: payload,
        },
      ]),
      "test/account",
    );

    expect(text).toContain(String.raw`![账\]号](${wrappedPayload})`);
    expect(text).toContain("https://open.weixin.qq.com/qr/code?username=innenu%26x%3D1");
    expect(text).toContain(String.raw`[a\]b@example.com](mailto:a]b@example.com)`);
    expect(text).not.toMatch(/<img src=x/u);
  });

  it("phone 的电话与邮箱不产生注入", () => {
    const text = getPageText(
      createPage([
        {
          tag: "phone",
          header: "联系方式",
          fName: "老师",
          num: "0431-85099999",
          mail: "a]b@example.com",
          site: payload,
        },
      ]),
      "test/phone",
    );

    expect(text).toContain("[0431-85099999](tel:0431-85099999)");
    expect(text).toContain(String.raw`[a\]b@example.com](mailto:a]b@example.com)`);
    expect(text).not.toMatch(/<img src=x/u);
  });

  it("合法 URL 产物保持原样", () => {
    const text = getPageText(
      createPage([
        { tag: "img", src: "https://example.com/a.png", desc: "图片" },
        { tag: "carousel", images: ["https://example.com/one.png"] },
        { tag: "audio", src: "https://example.com/a.mp3", name: "音频" },
        { tag: "video", src: "https://example.com/a.mp4", title: "视频" },
      ]),
      "test/legal",
    );

    expect(text).toContain("![图片](https://example.com/a.png)");
    expect(text).toContain("![''](https://example.com/one.png)");
    expect(text).toContain("[音频: 音频](https://example.com/a.mp3)");
    expect(text).toContain("[视频: 视频](https://example.com/a.mp4)");
  });
});

describe("action 代码围栏", () => {
  it("内容中的三反引号不会提前闭合围栏", () => {
    const markdown = getPageMarkdown(
      createPage([{ tag: "action", content: "```js\nalert(1)\n```" }]),
      { location: "test/fence" },
    );

    expect(markdown).toContain("````text\n```js\nalert(1)\n```\n````");
    expect(markdown).not.toMatch(/^```text$/mu);
  });

  it("围栏长度随内容中最长反引号增长", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "action", content: "````" }]), {
      location: "test/fence-long",
    });

    expect(markdown).toContain("`````text\n````\n`````");
  });

  it("普通内容仍使用三反引号", () => {
    const markdown = getPageMarkdown(createPage([{ tag: "action", content: "普通内容" }]), {
      location: "test/fence-plain",
    });

    expect(markdown).toContain("```text\n普通内容\n```");
  });
});

describe("官方账号 username 编码", () => {
  it("username 中的保留字符被编码", () => {
    const markdown = getPageMarkdown(
      createPage([
        {
          tag: "text",
          header: "官方账号",
          text: "正文",
          action: "official",
          username: "innenu&x=1",
        },
      ]),
      { location: "test/official" },
    );

    expect(markdown).toContain(
      "- [查看详情](https://open.weixin.qq.com/qr/code?username=innenu%26x%3D1)",
    );
  });

  it("username 中的空格与括号不会截断链接", () => {
    const markdown = getPageMarkdown(
      createPage([
        { tag: "text", header: "官方账号", text: "正文", action: "official", username: "a b(c)" },
      ]),
      { location: "test/official-space" },
    );

    expect(markdown).toContain(
      "- [查看详情](<https://open.weixin.qq.com/qr/code?username=a%20b(c)>)",
    );
  });
});
