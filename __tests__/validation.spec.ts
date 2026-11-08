import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../src/helpers/validation.js";
import { getPageContent, getPageJSON } from "../src/page/json.js";
import { checkPageConfig, checkPageContent, checkPageData } from "../src/page/schema.js";
import type { PageConfig, PageData } from "../src/page/schema.js";

describe("validation", () => {
  it("合法页面不会产生校验问题，也不会向控制台输出错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page: PageConfig = {
      title: "关于我们",
      content: [{ tag: "text", text: "欢迎" }],
    };

    expect(checkPageContent(page.content, "guide/about", "guide/about")).toStrictEqual([]);
    expect(checkPageConfig(page, "guide/about")).toStrictEqual([]);

    const pageData = getPageJSON(page, "guide/about");

    expect(pageData.id).toBe("guide/about");
    expect(checkPageData(pageData, "guide/about")).toStrictEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("未知 tag 在 check 时抛出 ValidationError，在 check:false 时抛出明确的错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const content = [{ tag: "bogus", foo: 1 }] as unknown as PageData["content"];

    expect(() => getPageContent(content, "guide/about", { check: true })).toThrow(ValidationError);

    expect(() => getPageContent(content, "guide/about", { check: false })).toThrow(
      /存在非法 tag bogus/u,
    );

    errorSpy.mockRestore();
  });

  it("非法组件内容会抛出 ValidationError 并在消息中包含位置与问题", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const page: PageConfig = {
      title: "关于我们",
      content: [{ tag: "list", items: [{ type: "navigator", text: "导航", bogus: true }] }],
    } as unknown as PageConfig;

    const getError = (): unknown => {
      try {
        getPageJSON(page, "guide/about");

        return null;
      } catch (err) {
        return err;
      }
    };

    const err = getError();

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toContain("页面内容校验失败");
    expect((err as Error).message).toContain("guide/about");

    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), expect.any(String));

    errorSpy.mockRestore();
  });

  it("checkPageContent / checkPageConfig / checkPageData 返回问题数组而非抛出", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(checkPageContent([], "a/b")).not.toStrictEqual([]);

    const configWithUnknownKey = {
      title: "关于我们",
      content: [{ tag: "text", text: "欢迎" }],
      bogus: 1,
    } as unknown as PageConfig;

    expect(checkPageConfig(configWithUnknownKey, "guide/about")).not.toStrictEqual([]);

    const invalidPageData = {
      title: "关于我们",
      content: [{ tag: "text", text: "欢迎" }],
      aiPriority: 1,
    } as unknown as PageData;

    expect(checkPageData(invalidPageData, "guide/about")).not.toStrictEqual([]);

    errorSpy.mockRestore();
  });

  it("check:false 时跳过校验，不因非法配置中止生成", () => {
    const configWithUnknownKey = {
      title: "关于我们",
      content: [{ tag: "text", text: "欢迎" }],
      bogus: 1,
    } as unknown as PageConfig;

    const pageData = getPageJSON(configWithUnknownKey, "guide/about", [], { check: false });

    expect(pageData.id).toBe("guide/about");
  });
});
