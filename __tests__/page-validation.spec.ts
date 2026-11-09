import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../src/helpers/validation.js";
import { getPageJSON } from "../src/page/json.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { checkPageContent } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const location = "guide/broken";

const expectValidationError = (fn: () => unknown): ValidationError => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);

    return err as ValidationError;
  }

  throw new Error("expected ValidationError to be thrown");
};

/** 页面内容损坏时，三条管线都应抛出 ValidationError，而不是 TypeError 或普通 Error */
const damagedPages: { name: string; page: PageConfig }[] = [
  {
    name: "content 非数组",
    page: { title: "损坏页面", content: "not-an-array" } as unknown as PageConfig,
  },
  {
    name: "组件为 null",
    page: { title: "损坏页面", content: [null] } as unknown as PageConfig,
  },
  {
    name: "grid.items 为字符串",
    page: {
      title: "损坏页面",
      content: [{ tag: "grid", header: "入口", items: "not-an-array" }],
    } as unknown as PageConfig,
  },
];

interface PipelineRunners {
  json: () => unknown;
  markdown: () => string;
  text: () => string;
}

const createPipelines = (page: PageConfig): PipelineRunners => ({
  json: (): unknown => getPageJSON(page, location, [], { check: true }),
  markdown: (): string => getPageMarkdown(page, { location, check: true }),
  text: (): string => getPageText(page, location, { check: true }),
});

describe.each(damagedPages)("损坏页面内容：$name", ({ page }) => {
  it.each(["json", "markdown", "text"] as const)(
    "%s 管线在 check 为 true 时抛出 ValidationError",
    (pipeline) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const err = expectValidationError(createPipelines(page)[pipeline]);

        expect(err.message).toContain(location);
        expect(err.message).toMatch(/页面(?:内容)?校验失败/u);
        expect(err.issues.length).toBeGreaterThan(0);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});

// 与 pages/other/enroll/second-degree/2022.yml 的坏表结构一致：表头 4 列，第 5 行多出一格
const tablePage: PageConfig = {
  title: "第二学士学位招生",
  content: [
    {
      tag: "table",
      header: ["招生专业", "专业类别", "原本科专业所属学科门类及专业类要求", "招生计划"],
      body: [
        ["法学", "普通", "法学", "30"],
        ["英语", "普通", "文学", "20"],
        ["会计学", "普通", "管理学", "20"],
        ["金融学", "普通", "经济学", "20"],
        ["计算机科学与技术", "普通", "理学", "8", "8"],
      ],
    },
  ],
};

describe("表格列数校验", () => {
  it("checkPageContent 会执行表格列数检查并给出第 5 行问题", () => {
    const issues = checkPageContent(tablePage.content, "pages/other/enroll/second-degree/2022");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("表格第 5 行");
    expect(issues[0]).toContain("期望 4 列");
    expect(issues[0]).toContain("实际 5 列");
  });

  it.each(["json", "markdown", "text"] as const)(
    "%s 管线在 check 为 true 时抛出 ValidationError",
    (pipeline) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const err = expectValidationError(createPipelines(tablePage)[pipeline]);
        const issueText = err.issues.join("\n");

        expect(issueText).toContain("表格第 5 行");
        expect(issueText).toContain("期望 4 列");
        expect(issueText).toContain("实际 5 列");
      } finally {
        errorSpy.mockRestore();
      }
    },
  );

  it("列数一致的表格不会产生校验问题", () => {
    const validPage: PageConfig = {
      ...tablePage,
      content: [
        {
          tag: "table",
          header: ["招生专业", "招生计划"],
          body: [["法学", "30"]],
        },
      ],
    };

    expect(checkPageContent(validPage.content, location)).toStrictEqual([]);
  });
});
