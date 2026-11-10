import { describe, expect, it, vi } from "vitest";
import * as zod from "zod";

import { formatZodError, ValidationError } from "../src/helpers/validation.js";
import { getPageContent, getPageJSON } from "../src/page/json.js";
import {
  checkPageConfig,
  checkPageContent,
  checkPageData,
  pageContentSchema,
  pageTitleSchema,
} from "../src/page/schema.js";
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

/**
 * 解析失败时取出错误对象
 *
 * 调用前需先用 expect 断言解析失败，避免误用成功结果。
 *
 * @param result 解析结果
 * @returns Zod 错误对象
 */
const failureOf = <T>(result: zod.ZodSafeParseResult<T>): zod.ZodError<T> =>
  (result as zod.ZodSafeParseError<T>).error;

describe("zod 错误消息格式化", () => {
  it("显式自定义 message 优先于 zhCN locale 文案", () => {
    const result = pageTitleSchema.safeParse("");

    expect(result.success).toBe(false);
    expect(formatZodError(failureOf(result))).toBe("✖ 页面标题不能为空");
  });

  it("联合类型展开分支并保留字段路径", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = pageContentSchema.safeParse([{ tag: "card", title: "" }]);

    expect(result.success).toBe(false);

    const detail = formatZodError(failureOf(result));

    expect(detail).toContain("卡片标题不能为空（位置: 0.title）");
    expect(detail).not.toContain("✖ 无效输入（位置: 0）");

    const issues = checkPageContent(
      [{ tag: "card", title: "" }] as unknown as PageData["content"],
      "guide/about",
    );

    expect(issues.join("\n")).toContain("0.title");
    expect(issues.join("\n")).toContain("卡片标题不能为空");

    errorSpy.mockRestore();
  });

  it("联合类型自身的自定义 error 文案优先于分支问题", () => {
    const union = zod.union([zod.string().startsWith("a"), zod.number()], {
      error: () => "取值不符合要求",
    });
    const result = union.safeParse(true);

    expect(result.success).toBe(false);
    expect(formatZodError(failureOf(result))).toBe("✖ 取值不符合要求");
  });

  it("判别值不匹配时仍保留联合类型自身的自定义 error 文案", () => {
    const union = zod.discriminatedUnion(
      "tag",
      [zod.object({ tag: zod.literal("a") }), zod.object({ tag: zod.literal("b") })],
      { error: () => "自定义判别错误" },
    );
    const result = union.safeParse({ tag: "zzz" });

    expect(result.success).toBe(false);
    expect(formatZodError(failureOf(result))).toBe("✖ 自定义判别错误（位置: tag）");
  });

  it("联合类型分支的重复文案只保留一次", () => {
    const union = zod.union([
      zod.object({ title: zod.string().min(2, "标题不合法") }),
      zod.object({ title: zod.string().regex(/^x/u, "标题不合法") }),
    ]);
    const result = union.safeParse({ title: "" });

    expect(result.success).toBe(false);

    const detail = formatZodError(failureOf(result));

    expect(detail.match(/标题不合法/gu)).toHaveLength(1);
    expect(detail).toContain("标题不合法（位置: title）");
  });

  it("联合类型分支问题过多时截断并注明省略数量", () => {
    const union = zod.union(
      Array.from({ length: 9 }, (_, index) =>
        zod.object({ [`f${index}`]: zod.string().min(1, "必填字段不能为空") }),
      ),
    );
    const input = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`f${index}`, ""]));
    const result = union.safeParse(input);

    expect(result.success).toBe(false);

    const detail = formatZodError(failureOf(result));

    expect(detail).toContain("其余 4 条问题已省略");
    expect(detail).toContain("必填字段不能为空（位置: f0）");
    expect(detail).not.toContain("必填字段不能为空（位置: f5）");
    expect(detail.match(/必填字段不能为空/gu)).toHaveLength(5);
  });

  it("判别值不匹配时列出可用取值", () => {
    const result = pageContentSchema.safeParse([{ tag: "bogus" }]);

    expect(result.success).toBe(false);

    const detail = formatZodError(failureOf(result));

    expect(detail).toContain("无效的 tag 值，期望以下之一：");
    expect(detail).toContain("card");
    expect(detail).toContain("（位置: 0.tag）");
  });
});
