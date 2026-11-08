import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";

/**
 * 测试用 URL 转换器：把站内动作链接转换为网页地址
 *
 * @param url 待转换的链接
 * @returns 转换后的地址，非站内链接返回 null
 */
const convertSiteLink = (url: string): string | null => {
  if (url.startsWith("official?"))
    return `https://open.weixin.qq.com/qr/code?username=${url.slice("official?".length)}`;

  if (url.startsWith("article?")) return `https://www.nenu.edu.cn/${url.slice("article?".length)}`;

  return null;
};

/**
 * 构造包含官方账号与文章动作的测试页面
 *
 * @returns 页面配置
 */
const createPage = (): PageConfig =>
  ({
    title: "通知",
    content: [
      { tag: "action", header: "官方账号", content: "official?innenu" },
      { tag: "action", header: "文章", content: "article?info/1031/255432.htm" },
    ],
  }) as unknown as PageConfig;

describe(getPageMarkdown, () => {
  it("在网页模式下使用 urlConverter 输出 action 链接", () => {
    const markdown = getPageMarkdown(createPage(), {
      location: "guide/notice",
      urlConverter: convertSiteLink,
    });

    expect(markdown).toContain("[官方账号](https://open.weixin.qq.com/qr/code?username=innenu)");
    expect(markdown).toContain("[文章](https://www.nenu.edu.cn/info/1031/255432.htm)");
    expect(markdown).not.toContain("```text");
    expect(markdown).not.toContain("::: action");
  });

  it("在 miniapp 模式下使用转换后的链接并保留 action 容器", () => {
    const markdown = getPageMarkdown(createPage(), {
      location: "guide/notice",
      mode: "miniapp",
      urlConverter: convertSiteLink,
    });

    expect(markdown).toContain(
      "#### 官方账号\n\n::: action\n[官方账号](https://open.weixin.qq.com/qr/code?username=innenu)\n:::",
    );
    expect(markdown).toContain(
      "::: action\n[文章](https://www.nenu.edu.cn/info/1031/255432.htm)\n:::",
    );
    expect(markdown).not.toContain("```text");
  });
});
