import { describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import type * as MarkdownRenderers from "../src/page/markdown-renderers.js";
import type { ComponentOptions } from "../src/page/schema.js";

/**
 * 构造 schema 之外的组件，模拟“新增组件尚未注册渲染分支”或直接调用渲染函数的场景。
 *
 * 公共入口的 schema 会拒绝未知 tag，所以只能绕过类型系统来触发 default 分支。
 *
 * @param tag 组件 tag
 * @returns 组件配置
 */
const createUnsupportedComponent = (tag: string): ComponentOptions =>
  ({ tag }) as unknown as ComponentOptions;

interface RendererFixture {
  renderComponentMarkdown: typeof MarkdownRenderers.renderComponentMarkdown;
  warnSpy: MockInstance<typeof console.warn>;
}

/**
 * 加载一份干净的渲染器模块并监听 `console.warn`
 *
 * 警告记录是模块级 Set，`vi.resetModules()` 才能让每个用例从“未警告过”开始。
 *
 * @returns 渲染函数与警告监听器
 */
const createRendererFixture = async (): Promise<RendererFixture> => {
  vi.resetModules();

  const { renderComponentMarkdown } = await import("../src/page/markdown-renderers.js");

  return {
    renderComponentMarkdown,
    warnSpy: vi.spyOn(console, "warn").mockReturnValue(undefined),
  };
};

const getWarningMessages = (spy: MockInstance<typeof console.warn>): string[] =>
  spy.mock.calls.map(([message]) => String(message));

describe("renderComponentMarkdown 未支持组件的警告", () => {
  it("对未知 tag 输出可读的中文警告，同时保持返回空字符串且不抛错", async () => {
    const { renderComponentMarkdown, warnSpy } = await createRendererFixture();

    try {
      const component = createUnsupportedComponent("future-widget");

      expect(() =>
        renderComponentMarkdown(component, { location: "guide/x page.content[0]" }),
      ).not.toThrow();
      expect(renderComponentMarkdown(component, { location: "guide/x page.content[0]" })).toBe("");

      const messages = getWarningMessages(warnSpy);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("future-widget");
      expect(messages[0]).toContain("Markdown 渲染");
      expect(messages[0]).toContain("guide/x page.content[0]");
      expect(messages[0]).toMatch(/未支持|未实现/u);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("同一 tag 只警告一次，不同 tag 各自警告", async () => {
    const { renderComponentMarkdown, warnSpy } = await createRendererFixture();

    try {
      const first = createUnsupportedComponent("future-widget");
      const second = createUnsupportedComponent("another-widget");

      renderComponentMarkdown(first);
      renderComponentMarkdown(first);
      renderComponentMarkdown(second);

      const messages = getWarningMessages(warnSpy);

      expect(messages).toHaveLength(2);
      expect(messages.filter((message) => message.includes("future-widget"))).toHaveLength(1);
      expect(messages.filter((message) => message.includes("another-widget"))).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("文本管线同样警告，且与站点管线共用同一个 tag 记录", async () => {
    const { renderComponentMarkdown, warnSpy } = await createRendererFixture();

    try {
      const component = createUnsupportedComponent("future-widget");

      expect(renderComponentMarkdown(component, { dialect: "text" })).toBe("");

      // 站点管线随后处理同一个 tag 时不应再次刷屏
      expect(renderComponentMarkdown(component)).toBe("");

      const messages = getWarningMessages(warnSpy);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("future-widget");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("schema 内已存在但未注册 Markdown 渲染的 footer 组件也会告警", async () => {
    const { renderComponentMarkdown, warnSpy } = await createRendererFixture();

    try {
      // footer 是合法组件，但两条渲染管线都没有对应分支，目前会被静默丢弃。
      const footer: ComponentOptions = { tag: "footer", author: "测试" };

      expect(renderComponentMarkdown(footer)).toBe("");

      const messages = getWarningMessages(warnSpy);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("footer");
      expect(messages[0]).toMatch(/未支持|未实现/u);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
