// oxlint-disable no-script-url -- 安全测试需要构造危险协议样本
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";

const createPage = (overrides: Partial<PageConfig> = {}): PageConfig => ({
  title: "测试页面",
  content: [{ tag: "title", text: "标题" }],
  ...overrides,
});

const getFrontmatter = (markdown: string): Record<string, unknown> => {
  const match = /^---\n(?<yaml>[\s\S]*?)\n---/u.exec(markdown);

  if (!match?.groups?.yaml) throw new Error("未找到 frontmatter");

  return load(match.groups.yaml) as Record<string, unknown>;
};

describe("页面 Markdown frontmatter", () => {
  it("作者与来源为空数组时不输出裸键名", () => {
    const markdown = getPageMarkdown(createPage({ author: [], cite: [] }), {
      location: "guide/empty-meta",
    });

    const frontmatter = getFrontmatter(markdown);

    expect(markdown).not.toMatch(/^author:\s*$/mu);
    expect(markdown).not.toMatch(/^cite:\s*$/mu);
    expect(frontmatter).not.toHaveProperty("author");
    expect(frontmatter).not.toHaveProperty("cite");
    expect(frontmatter.isOriginal).toBe(true);
  });

  it("来源为空数组时页面仍标记为原创", () => {
    const markdown = getPageMarkdown(createPage({ cite: [] }), { location: "guide/original" });

    expect(markdown).toContain("isOriginal: true");
    expect(getFrontmatter(markdown)).not.toHaveProperty("cite");
  });

  it("作者为空数组但来源存在时保留来源", () => {
    const markdown = getPageMarkdown(
      createPage({ author: [], cite: ["https://example.com/source"] }),
      { location: "guide/cite-only" },
    );

    const frontmatter = getFrontmatter(markdown);

    expect(frontmatter).not.toHaveProperty("author");
    expect(frontmatter.cite).toStrictEqual(["https://example.com/source"]);
    expect(frontmatter).not.toHaveProperty("isOriginal");
  });

  it("来源值需要引号时统一使用 YAML 引号", () => {
    const markdown = getPageMarkdown(createPage({ cite: ["来源: 校内"] }), {
      location: "guide/quoted-cite",
    });

    expect(markdown).toContain('cite:\n  - "来源: 校内"');
    expect(getFrontmatter(markdown).cite).toStrictEqual(["来源: 校内"]);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["&#106;avascript:alert(1)"],
    ["&#x0000006a;avascript:alert(1)"],
    ["javascript&#x000003a;alert(1)"],
    ["javascript&#00000058;alert(1)"],
  ])("丢弃危险来源 %s", (cite) => {
    const markdown = getPageMarkdown(createPage({ cite }), { location: "guide/dangerous-cite" });
    const frontmatter = getFrontmatter(markdown);

    expect(markdown).not.toMatch(/^cite:/mu);
    expect(frontmatter).not.toHaveProperty("cite");
    // 页面存在来源、只是无法安全展示，不能误标为原创。
    expect(frontmatter).not.toHaveProperty("isOriginal");
  });

  it("混合合法与非法来源时只保留合法项", () => {
    const markdown = getPageMarkdown(
      createPage({
        cite: [
          "https://example.com/source",
          "javascript:alert(1)",
          "data:text/html,<script>alert(1)</script>",
          "来源: 校内",
          "&#106;avascript:alert(1)",
        ],
      }),
      { location: "guide/mixed-cite" },
    );

    expect(getFrontmatter(markdown).cite).toStrictEqual([
      "https://example.com/source",
      "来源: 校内",
    ]);
    expect(markdown).not.toContain("javascript:");
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("isOriginal");
  });

  it("来源为字符串时同样逐条校验", () => {
    const markdown = getPageMarkdown(createPage({ cite: "javascript:alert(1)" }), {
      location: "guide/string-cite",
    });

    expect(markdown).not.toMatch(/^cite:/mu);
    expect(getFrontmatter(markdown)).not.toHaveProperty("isOriginal");
  });

  it("合法 icon 写入 frontmatter", () => {
    const markdown = getPageMarkdown(createPage({ icon: "https://example.com/icon.svg" }), {
      location: "guide/icon",
    });

    expect(markdown).toContain("icon: https://example.com/icon.svg");
  });

  it("危险 icon 协议不写入 frontmatter", () => {
    const markdown = getPageMarkdown(createPage({ icon: "javascript:alert(1).svg" }), {
      location: "guide/dangerous-icon",
    });

    expect(markdown).not.toMatch(/^icon:/mu);
  });
});
