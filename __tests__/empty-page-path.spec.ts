import { describe, expect, it, vi } from "vitest";

import { getCardJSON } from "../src/components/card/json.js";
import { getCardMarkdown } from "../src/components/card/markdown.js";
import type { CardComponentOptions } from "../src/components/card/schema.js";
import { getGridJSON } from "../src/components/grid/json.js";
import type { GridComponentOptions } from "../src/components/grid/schema.js";
import { getListJSON } from "../src/components/list/json.js";
import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "../src/components/list/schema.js";
import { getTextJSON } from "../src/components/text/json.js";
import type { PathTextComponentOptions } from "../src/components/text/schema.js";
import { getPageJSON } from "../src/page/json.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";
import { resolvePagePath } from "../src/utils.js";

describe("page path resolution", () => {
  it("returns an empty path for null or undefined targets", () => {
    expect(resolvePagePath(null, "guide/index")).toBe("");
    expect(resolvePagePath(undefined, "guide/index")).toBe("");
    expect(resolvePagePath("", "guide/index")).toBe("");
  });

  it("keeps resolving existing paths", () => {
    expect(resolvePagePath("contact", "guide/index")).toBe("guide/contact");
    expect(resolvePagePath("/guide/index", "guide/index")).toBe("guide/index");
  });
});

describe("component JSON generators drop empty paths", () => {
  it("drops a null card path", () => {
    const card = {
      tag: "card",
      title: "招生办公室",
      path: null,
    } as unknown as CardComponentOptions;
    const output = getCardJSON(card, "guide/index");

    expect(output).not.toHaveProperty("path");
    expect(output).toMatchObject({ tag: "card", title: "招生办公室" });
  });

  it("drops null grid item paths and keeps other paths", () => {
    const grid = {
      tag: "grid",
      items: [
        { text: "有路径", icon: "https://example.com/icon.png", path: "contact" },
        { text: "无路径", icon: "https://example.com/icon.png", path: null },
      ],
    } as unknown as GridComponentOptions;

    const output = getGridJSON(grid, "guide/index");

    expect(output.items[0]).toMatchObject({ path: "guide/contact" });
    expect(output.items[1]).not.toHaveProperty("path");
    expect(output.items[1]).toMatchObject({ text: "无路径" });
  });

  it("drops null list item paths", () => {
    const list = {
      tag: "list",
      items: [
        { text: "有路径", path: "contact" },
        { text: "无路径", path: null },
      ],
    } as unknown as ListComponentOptions;

    const output = getListJSON(list, "guide/index");

    expect(output.items[0]).toMatchObject({ path: "guide/contact" });
    expect(output.items[1]).not.toHaveProperty("path");
  });

  it("drops a null path on functional list items", () => {
    const list = {
      tag: "functional-list",
      items: [{ type: "navigator", text: "联系方式", path: null }],
    } as unknown as FunctionalListComponentOptions;

    const output = getListJSON(list, "guide/index");

    expect(output.items[0]).not.toHaveProperty("path");
    expect(output.items[0]).toMatchObject({ openType: "navigate" });
  });

  it("drops a null text path", () => {
    const text = {
      tag: "text",
      text: "查看详情",
      type: "tip",
      path: null,
    } as unknown as PathTextComponentOptions;

    const output = getTextJSON(text, "guide/index");

    expect(output).not.toHaveProperty("path");
    expect(output.text).toStrictEqual(["查看详情"]);
  });
});

describe("markdown generation tolerates empty paths", () => {
  it("renders a card without a path as empty output", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const card = {
      tag: "card",
      title: "招生办公室",
      desc: "工作日 8:00 - 17:00",
      path: null,
    } as unknown as CardComponentOptions;

    expect(getCardMarkdown(card)).toBe("");

    errorSpy.mockRestore();
  });

  it("generates a page with null paths without throwing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const page = {
      title: "联系我们",
      desc: "全国招生咨询",
      content: [
        { tag: "card", title: "无路径卡片", path: null },
        {
          tag: "grid",
          items: [{ text: "无路径入口", icon: "https://example.com/icon.png", path: null }],
        },
        { tag: "list", items: [{ text: "无路径列表项", path: null }] },
        { tag: "text", text: "说明", type: "tip", path: null },
      ],
    } as unknown as PageConfig;

    // path: null is intentionally invalid per schema; skip validation to test
    // that generation itself tolerates empty paths
    const pageData = getPageJSON(page, "guide/index", [], { check: false });
    const markdown = getPageMarkdown(page);
    const text = getPageText(page);

    expect(pageData.content[0]).not.toHaveProperty("path");
    expect(pageData.content[1]).toMatchObject({
      items: [expect.not.objectContaining({ path: expect.anything() })],
    });
    expect(pageData.content[2]).toMatchObject({
      items: [expect.not.objectContaining({ path: expect.anything() })],
    });
    expect(pageData.content[3]).not.toHaveProperty("path");

    // 空路径不应进入 Markdown 输出
    expect(markdown).not.toContain("null");
    expect(text).not.toContain("null");

    errorSpy.mockRestore();
  });
});
