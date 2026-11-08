import { describe, expect, it, vi } from "vitest";

import { getPageJSON } from "../src/page/json.js";
import { checkPageData } from "../src/page/schema.js";
import type { PageConfig } from "../src/page/schema.js";

describe("getPageJSON PageData 字段", () => {
  it("不会把页面配置的 AI 字段带进 PageData", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = {
      title: "关于我们",
      content: [{ tag: "text", text: "欢迎" }],
      aiIgnore: true,
      aiPriority: 3,
      summary: "页面摘要",
      campus: "本部",
      keywords: ["关键词"],
    } as unknown as PageConfig;

    const pageData = getPageJSON(page, "guide/about");

    expect(pageData).not.toHaveProperty("aiIgnore");
    expect(pageData).not.toHaveProperty("aiPriority");
    expect(pageData).not.toHaveProperty("summary");
    expect(pageData).not.toHaveProperty("campus");
    expect(pageData).not.toHaveProperty("keywords");

    vi.restoreAllMocks();
  });

  it("生成的 PageData 可以通过自身 schema 校验", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page: PageConfig = {
      title: "关于我们",
      content: [{ tag: "text", text: ["欢迎"] }],
      icon: "https://example.com/icon.png",
      desc: "关于 inNENU",
      author: ["Mr.Hope", "inNENU"],
      grey: true,
      outdated: false,
      shareable: true,
      qrcode: true,
      contact: false,
      cite: "来源",
    };

    const pageData = getPageJSON(page, "guide/about");

    expect(pageData).toStrictEqual({
      title: "关于我们",
      id: "guide/about",
      content: [{ tag: "text", text: ["欢迎"] }],
      icon: "https://example.com/icon.png",
      desc: "关于 inNENU",
      author: "Mr.Hope、inNENU",
      cite: ["来源"],
      grey: true,
      outdated: false,
      shareable: true,
      qrcode: true,
      contact: false,
    });
    expect(checkPageData(pageData, "guide/about")).toStrictEqual([]);

    vi.restoreAllMocks();
  });
});
