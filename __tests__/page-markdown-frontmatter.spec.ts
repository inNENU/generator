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
});
