import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../src/helpers/validation.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const validPage: PageConfig = {
  title: "关于我们",
  content: [{ tag: "text", text: "欢迎" }],
};

/** 标题为空（配置问题），但组件本身合法，仍可正常渲染 */
const tolerantPage = {
  title: "",
  content: [{ tag: "text", text: "正文" }],
} as unknown as PageConfig;

/** 标题为空（配置问题）且组件带多余字段（内容问题），但两者都不影响正常渲染 */
const invalidPage = {
  title: "",
  content: [{ tag: "text", text: "正文", extra: true }],
} as unknown as PageConfig;

const expectValidationError = (fn: () => string): ValidationError => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);

    return err as ValidationError;
  }

  throw new Error("expected ValidationError to be thrown");
};

describe("getPageMarkdown check 选项", () => {
  it("默认为 false，非法页面仍按宽松行为生成 Markdown", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markdown = getPageMarkdown(tolerantPage, { location: "guide/about" });

      expect(markdown).toContain("title: ");
      expect(markdown).toContain("正文");
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("check 为 true 时汇总配置与内容问题并抛出 ValidationError", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const err = expectValidationError(() =>
        getPageMarkdown(invalidPage, { location: "guide/about", check: true }),
      );

      expect(err.message).toContain("guide/about 页面内容校验失败");
      expect(err.issues.length).toBeGreaterThanOrEqual(2);
      expect(err.issues.join("\n")).toContain("（位置: title）");
      expect(err.issues.join("\n")).toContain("（位置: content.0）");
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("合法页面在 check 为 true 时正常生成且不输出错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markdown = getPageMarkdown(validPage, { location: "guide/about", check: true });

      expect(markdown).toContain("title: 关于我们");
      expect(markdown).toContain("欢迎");
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("getPageText check 选项", () => {
  it("默认为 false，非法页面仍按宽松行为生成文本", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const text = getPageText(tolerantPage, "guide/about");

      expect(text).toContain("正文");
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("check 为 true 时汇总配置与内容问题并抛出 ValidationError", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const err = expectValidationError(() =>
        getPageText(invalidPage, "guide/about", { check: true }),
      );

      expect(err.message).toContain("guide/about 页面内容校验失败");
      expect(err.issues.length).toBeGreaterThanOrEqual(2);
      expect(err.issues.join("\n")).toContain("（位置: title）");
      expect(err.issues.join("\n")).toContain("（位置: content.0）");
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("合法页面在 check 为 true 时正常生成且不输出错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const text = getPageText(validPage, "guide/about", { check: true });

      expect(text).toContain("# 关于我们");
      expect(text).toContain("欢迎");
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
