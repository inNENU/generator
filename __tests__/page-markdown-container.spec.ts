import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import { getPageText } from "../src/page/text.js";
import type { PageConfig } from "../src/typings.js";

const buildPage = (text: string): PageConfig => ({
  title: "提示页",
  content: [{ tag: "text", type: "tip", header: "提示", text }],
});

describe("文本 Markdown 提示框正文", () => {
  it("转义正文行首的容器闭合与标题语法", () => {
    const text = getPageText(
      buildPage("正常行\n::: danger\n伪造容器\n:::\n# 伪标题\n> 伪引用"),
      "guide/tip",
      {
        mode: "miniapp",
      },
    );

    expect(text).toContain(String.raw`\::: danger`);
    expect(text).toContain(String.raw`\# 伪标题`);
    // `>` 已被 HTML 转义成 &gt;，不会形成引用块
    expect(text).toContain("&gt; 伪引用");
    // 正文不再新增任何裸闭合标记，只剩容器自身的一行闭合
    expect(text.split("\n").filter((line) => line.trim() === ":::")).toHaveLength(1);
  });

  it("正文中的围栏代码不再提前打开代码块", () => {
    const text = getPageText(buildPage("说明\n```ts\nconst a = 1;\n```"), "guide/tip", {
      mode: "miniapp",
    });

    expect(text).toContain("\\```ts");
  });

  it("成对代码围栏按既有行为全部转义", () => {
    const text = getPageText(buildPage("说明\n```ts\nconst a = 1;\n```"), "guide/tip", {
      mode: "miniapp",
    });

    expect(text).toContain("\\```ts");
    expect(text).toContain("\\```\n");
  });
});

describe("站点 Markdown 提示框正文", () => {
  it("转义正文行首的容器语法并保留标题", () => {
    const markdown = getPageMarkdown(
      buildPage("正常行\n::: danger\n伪造容器\n:::\n# 伪标题\n> 伪引用"),
      { location: "guide/tip" },
    );

    expect(markdown).toContain(String.raw`\::: danger`);
    expect(markdown).toContain("# 伪标题");
    expect(markdown).not.toContain(String.raw`\# 伪标题`);
    expect(markdown).toContain("&gt; 伪引用");
    // 只剩提示框自身的一行闭合标记，正文中的 `:::` 不会提前闭合容器
    expect(markdown.split("\n").filter((line) => line.trim() === ":::")).toHaveLength(1);
  });

  it("转义与提示框等长及更长的容器标记", () => {
    const markdown = getPageMarkdown(buildPage("正文\n:::: warning\n冒充对齐容器\n::::"), {
      location: "guide/tip",
    });

    expect(markdown).toContain(String.raw`\:::: warning`);
    expect(markdown).toContain(String.raw`\::::`);
  });

  it("保留成对代码围栏，仅转义未闭合围栏", () => {
    const paired = getPageMarkdown(buildPage("说明\n```ts\nconst a = 1;\n```"), {
      location: "guide/tip",
    });

    expect(paired).toContain("```ts\nconst a = 1;\n```");
    expect(paired).not.toContain("\\```");

    const unclosed = getPageMarkdown(buildPage("说明\n```ts\nconst a = 1;"), {
      location: "guide/tip",
    });

    expect(unclosed).toContain("\\```ts");
  });

  it("列表项换行后的容器语法同样转义", () => {
    const markdown = getPageMarkdown(
      {
        title: "列表页",
        content: [{ tag: "ul", text: "第一行\n::: danger\n第二行" }],
      },
      { location: "guide/list" },
    );

    expect(markdown).toContain(String.raw`\::: danger`);
    expect(markdown.split("\n").filter((line) => line.trim() === ":::")).toHaveLength(0);
  });
});

describe("站点 Markdown 普通正文", () => {
  it("保留标题与成对代码块", () => {
    const markdown = getPageMarkdown(
      {
        title: "普通页",
        content: [{ tag: "text", text: "# 一级标题\n\n正文\n\n```ts\nconst a = 1;\n```" }],
      },
      { location: "guide/plain" },
    );

    expect(markdown).toContain("# 一级标题");
    expect(markdown).not.toContain(String.raw`\# 一级标题`);
    expect(markdown).toContain("```ts\nconst a = 1;\n```");
    expect(markdown).not.toContain("\\```");
  });

  it("普通列表项保留标题与成对代码块", () => {
    const markdown = getPageMarkdown(
      {
        title: "列表页",
        content: [{ tag: "ul", text: "# 标题\n\n```ts\nconst a = 1;\n```" }],
      },
      { location: "guide/list" },
    );

    expect(markdown).toContain("- # 标题");
    expect(markdown).toContain("```ts");
    expect(markdown).not.toContain(String.raw`\# 标题`);
    expect(markdown).not.toContain("\\```");
  });

  it("普通正文中的容器语法仍转义", () => {
    const markdown = getPageMarkdown(
      {
        title: "普通页",
        content: [{ tag: "text", text: "正文\n::: danger\n伪容器\n:::" }],
      },
      { location: "guide/plain" },
    );

    expect(markdown).toContain(String.raw`\::: danger`);
    expect(markdown).toContain(String.raw`\:::`);
  });
});
