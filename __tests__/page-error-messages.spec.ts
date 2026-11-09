import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../src/helpers/validation.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const location = "guide/error-messages";

const validContent = [{ tag: "text", text: "正文" }];

const createPage = (page: Partial<PageConfig>): PageConfig =>
  ({ title: "页面", content: validContent, ...page }) as PageConfig;

/**
 * 捕获同步异常，未抛出时直接让测试失败
 *
 * @param fn 待执行的回调
 * @returns 捕获到的异常
 */
const capture = (fn: () => unknown): Error => {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }

  throw new Error("expected an error to be thrown");
};

const pipelines = [
  {
    name: "getPageText",
    run: (page: PageConfig, check = false): string => getPageText(page, location, { check }),
  },
  {
    name: "getPageMarkdown",
    run: (page: PageConfig, check = false): string => getPageMarkdown(page, { location, check }),
  },
];

describe.each(pipelines)("$name 错误文案", ({ run }) => {
  it("缺少 page 时抛出中文普通 Error", () => {
    const err = capture(() => run(null as unknown as PageConfig));

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ValidationError);
    expect(err.message).toContain(`${location} 页面数据不存在`);
  });

  it("空 content 抛出中文普通 Error，而不是英文文案", () => {
    const err = capture(() => run({ title: "无内容页面" } as unknown as PageConfig));

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ValidationError);
    expect(err.message).toContain(location);
    expect(err.message).toContain("内容");
    expect(err.message).not.toMatch(/doesn't contain anything/u);
    expect(err.message).not.toContain("配置");
  });

  it("content 组件非法时归为内容处理失败", () => {
    const err = capture(() => run(createPage({ content: [null] } as never)));

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ValidationError);
    expect(err.message).toContain(`${location} 页面内容处理失败`);
    expect(err.message).not.toContain("页面配置处理失败");
    // 保留原始异常，便于定位组件级问题
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("page config 非法时归为配置处理失败", () => {
    const err = capture(() => run(createPage({ title: undefined })));

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ValidationError);
    expect(err.message).toContain(`${location} 页面配置处理失败`);
    expect(err.message).not.toContain("页面内容处理失败");
    // 保留 cause 链
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("配置校验失败时提示「配置」而不是「内容」", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const err = capture(() => run(createPage({ title: "长".repeat(31) }), true));

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain(`${location} 页面配置校验失败`);
      expect(err.message).not.toContain("页面内容校验失败");
      expect((err as ValidationError).issues.length).toBeGreaterThan(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
