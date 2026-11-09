import { describe, expect, it, vi } from "vitest";

import { checkAction } from "../src/components/action/schema.js";
import { checkGrid } from "../src/components/grid/schema.js";
import { checkFunctionalList, checkList } from "../src/components/list/schema.js";
import { checkLocation } from "../src/components/location/schema.js";
import { checkPhone } from "../src/components/phone/schema.js";
import { checkTable } from "../src/components/table/schema.js";
import { checkText } from "../src/components/text/schema.js";
import { checkTitle } from "../src/components/title/schema.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { ComponentOptions } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";
import type { PageConfig } from "../src/typings.js";
import { normalizeInlineText } from "../src/utils.js";

// 三种换行写法
const lineBreaks = ["\n", "\r\n", "\r"];

// 含换行的危险标题：换行后的 `:::` 会提前闭合容器
const dangerousHeader = (lineBreak: string): string => `咨询${lineBreak}::: danger`;

// 构造只含一个组件的页面
const buildPage = (component: ComponentOptions): PageConfig => ({
  title: "换行标题测试",
  content: [component],
});

// 取标题行（`#` 到 `######`），用于确认标题没有被换行拆开
const headingLines = (markdown: string): string[] =>
  markdown.split("\n").filter((line) => /^#{1,6} /u.test(line));

// 取行内文本行（`::: xxx` 容器头也按行内处理）
const inlineLines = (markdown: string, prefix: string): string[] =>
  markdown.split("\n").filter((line) => line.trimStart().startsWith(prefix));

// 独立成行的容器围栏，正常只应该有容器自身的一行闭合
const fenceLines = (markdown: string): string[] =>
  markdown.split("\n").filter((line) => line.trim() === ":::");

// 渲染层兜底的用例会传入非法数据，组件内部的 check* 会打日志；测试里统一静音，避免污染输出
const withSilencedConsole = <T>(run: () => T): T => {
  const spy = vi.spyOn(console, "error").mockReturnValue(undefined);

  try {
    return run();
  } finally {
    spy.mockRestore();
  }
};

// 运行 schema 校验并把问题拼成文本，供断言使用
const rejectedText = <T>(check: (data: T) => string[], data: T): string =>
  withSilencedConsole(() => check(data)).join("\n");

// 站点管线渲染（不传 check，保持默认 check=false）
const siteMarkdown = (page: PageConfig): string =>
  withSilencedConsole(() => getPageMarkdown(page, { location: "test/newline" }));

// 文本管线渲染
const textMarkdown = (page: PageConfig, mode: "web" | "miniapp" = "web"): string =>
  withSilencedConsole(() => getPageText(page, "test/newline", { mode }));

describe("标题换行防护", () => {
  describe(normalizeInlineText, () => {
    it.each(lineBreaks)("应该把 %j 压成单个空格", (lineBreak) => {
      expect(normalizeInlineText(` 咨询${lineBreak}::: danger `)).toBe("咨询 ::: danger");
    });

    it("应该保留普通空格", () => {
      expect(normalizeInlineText("咨询 电话")).toBe("咨询 电话");
    });

    it("应该保留不含换行的空白标题，避免改变既有输出", () => {
      expect(normalizeInlineText(" ")).toBe(" ");
    });
  });

  describe("schema 拒绝换行", () => {
    it.each(lineBreaks)("phone header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkPhone, {
          tag: "phone",
          header: dangerousHeader(lineBreak),
          num: 10086,
          fName: "三",
          lName: "张",
        }),
      ).toContain("标题不能包含换行");
    });

    it.each(lineBreaks)("text header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkText, { tag: "text", header: dangerousHeader(lineBreak), text: "正文" }),
      ).toContain("段落标题不能包含换行");
    });

    it.each(lineBreaks)("action header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkAction, {
          tag: "action",
          header: dangerousHeader(lineBreak),
          content: "https://example.com",
        }),
      ).toContain("标题不能包含换行");
    });

    it.each(lineBreaks)("table caption 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkTable, {
          tag: "table",
          header: ["名称"],
          body: [["值"]],
          caption: dangerousHeader(lineBreak),
        }),
      ).toContain("表格标题不能包含换行");
    });

    it.each(lineBreaks)("grid header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkGrid, {
          tag: "grid",
          header: dangerousHeader(lineBreak),
          items: [{ text: "项目", icon: "https://example.com/icon.png", path: "/guide/test" }],
        }),
      ).toContain("网格标题不能包含换行");
    });

    it.each(lineBreaks)("list header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkList, {
          tag: "list",
          header: dangerousHeader(lineBreak),
          items: [{ text: "项目" }],
        }),
      ).toContain("列表标题不能包含换行");
    });

    it.each(lineBreaks)("functional-list header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkFunctionalList, {
          tag: "functional-list",
          header: dangerousHeader(lineBreak),
          items: [{ text: "项目" }],
        }),
      ).toContain("列表标题不能包含换行");
    });

    it.each(lineBreaks)("location header 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkLocation, {
          tag: "location",
          header: dangerousHeader(lineBreak),
          points: [{ loc: "43.8,125.4" }],
        }),
      ).toContain("地点标题不能包含换行");
    });

    it.each(lineBreaks)("title text 含换行时报错", (lineBreak) => {
      expect(
        rejectedText(checkTitle, { tag: "title", text: dangerousHeader(lineBreak) }),
      ).toContain("标题文字不能包含换行");
    });

    it("站点管线开启校验时给出可读中文错误", () => {
      expect(() =>
        getPageMarkdown(
          buildPage({
            tag: "phone",
            header: "咨询\n::: danger",
            num: 10086,
            fName: "三",
            lName: "张",
          }),
          { location: "test/newline", check: true },
        ),
      ).toThrow(/标题不能包含换行/u);
    });
  });

  describe("站点管线渲染层防御", () => {
    it("phone 容器头中的换行不会结束容器", () => {
      const markdown = siteMarkdown(
        buildPage({
          tag: "phone",
          header: "咨询\n::: danger",
          num: 10086,
          fName: "三",
          lName: "张",
        }),
      );

      expect(inlineLines(markdown, "::: info")).toStrictEqual(["::: info 咨询 ::: danger"]);
      // 只剩容器自身的闭合行，没有伪造的 `:::` 围栏
      expect(fenceLines(markdown)).toHaveLength(1);
      expect(inlineLines(markdown, "::: danger")).toHaveLength(0);
    });

    it("text 容器头中的换行不会结束容器", () => {
      const markdown = siteMarkdown(
        buildPage({ tag: "text", type: "info", header: "咨询\n::: danger", text: "正文" }),
      );

      expect(inlineLines(markdown, "::: info")).toStrictEqual(["::: info 咨询 ::: danger"]);
      expect(fenceLines(markdown)).toHaveLength(1);
      expect(inlineLines(markdown, "::: danger")).toHaveLength(0);
    });

    it("action 标题中的换行不会拆开标题", () => {
      const markdown = siteMarkdown(
        buildPage({ tag: "action", header: "咨询\n::: danger", content: "https://example.com" }),
      );

      expect(headingLines(markdown)).toStrictEqual(["#### 咨询 ::: danger"]);
      expect(fenceLines(markdown)).toHaveLength(0);
    });

    it("table / grid / list / location / title 的标题与图注都保持单行", () => {
      const markdown = siteMarkdown({
        title: "换行标题测试",
        content: [
          { tag: "table", header: ["名称"], body: [["值"]], caption: "咨询\n::: danger" },
          {
            tag: "grid",
            header: "咨询\n::: danger",
            items: [{ text: "项目", icon: "https://example.com/icon.png", path: "/guide/test" }],
          },
          { tag: "list", header: "咨询\n::: danger", items: [{ text: "项目" }] },
          { tag: "location", header: "咨询\n::: danger", points: [{ loc: "43.8,125.4" }] },
          { tag: "title", text: "咨询\n::: danger" },
        ],
      });

      expect(headingLines(markdown)).toStrictEqual([
        "### 咨询 ::: danger",
        "#### 咨询 ::: danger {.innenu-grid-header}",
        "#### 咨询 ::: danger {.innenu-list-header}",
        "#### 咨询 ::: danger",
        "## 咨询 ::: danger",
      ]);
      expect(fenceLines(markdown)).toHaveLength(0);
    });
  });

  describe("文本管线渲染层防御", () => {
    it("miniapp 容器头中的换行不会结束容器", () => {
      const markdown = textMarkdown(
        buildPage({ tag: "text", type: "info", header: "咨询\n::: danger", text: "正文" }),
        "miniapp",
      );

      expect(inlineLines(markdown, "::: info")).toStrictEqual(["::: info 咨询 ::: danger"]);
      expect(fenceLines(markdown)).toHaveLength(1);
      expect(inlineLines(markdown, "::: danger")).toHaveLength(0);
    });

    it("非容器模式的标题保持单行", () => {
      const markdown = textMarkdown(
        buildPage({ tag: "text", header: "咨询\n::: danger", text: "正文" }),
      );

      expect(headingLines(markdown)).toStrictEqual(["# 换行标题测试", "### 咨询 ::: danger"]);
      expect(fenceLines(markdown)).toHaveLength(0);
    });

    it("phone 标题保持单行", () => {
      const markdown = textMarkdown(
        buildPage({
          tag: "phone",
          header: "咨询\n::: danger",
          num: 10086,
          fName: "三",
          lName: "张",
        }),
      );

      expect(headingLines(markdown)).toStrictEqual(["# 换行标题测试", "#### 咨询 ::: danger"]);
      expect(fenceLines(markdown)).toHaveLength(0);
    });

    it("grid / list / location / title 的标题都保持单行", () => {
      const markdown = textMarkdown({
        title: "换行标题测试",
        content: [
          {
            tag: "grid",
            header: "咨询\n::: danger",
            items: [{ text: "项目", icon: "https://example.com/icon.png", path: "/guide/test" }],
          },
          { tag: "list", header: "咨询\n::: danger", items: [{ text: "项目" }] },
          { tag: "location", header: "咨询\n::: danger", points: [{ loc: "43.8,125.4" }] },
          { tag: "title", text: "咨询\n::: danger" },
        ],
      });

      expect(headingLines(markdown)).toStrictEqual([
        "# 换行标题测试",
        "#### 咨询 ::: danger",
        "#### 咨询 ::: danger",
        "#### 咨询 ::: danger位置",
        "## 咨询 ::: danger",
      ]);
      expect(fenceLines(markdown)).toHaveLength(0);
    });
  });
});
