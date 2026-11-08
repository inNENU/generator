import { describe, expect, it } from "vitest";
import type * as zod from "zod";

import { pageConfigSchema, pageContentSchema, pageDataSchema } from "../src/page/schema.js";
import { locSchema } from "../src/schema/common.js";
import {
  markerCategorySchema,
  markerConfigSchema,
  markerDataSchema,
  markersConfigSchema,
  markersDataSchema,
} from "../src/schema/map.js";

/**
 * 获取 schema 校验失败时的 issue 列表
 *
 * @param schema 待校验的 schema
 * @param value 待校验的值
 * @returns Issue 列表，通过校验时为空数组
 */
const getIssues = (schema: zod.ZodType, value: unknown): zod.core.$ZodIssue[] => {
  const result = schema.safeParse(value);

  return result.success ? [] : result.error.issues;
};

/** 一个字段完整、可通过校验的页面配置 */
const validPageConfig = {
  title: "校园卡指南",
  desc: "校园卡办理与使用说明",
  summary: "校园卡办理、挂失与充值",
  keywords: ["校园卡", "挂失"],
  campus: "本部校区",
  aiPriority: 3,
  author: ["后勤管理处", "信息中心"],
  time: "2025-03-01",
  content: [
    { tag: "title", text: "校园卡服务" },
    { tag: "text", header: "办理流程", text: ["携带证件", "填写申请表"] },
    { tag: "list", header: "服务网点", items: [{ text: "本部校区" }] },
    { tag: "card", title: "网上服务大厅", url: "card-online" },
  ],
} as const;

/** 一个字段完整、可通过校验的页面数据 */
const validPageData = {
  title: "校园卡指南",
  id: "guide/card",
  author: "后勤管理处",
  desc: "校园卡办理与使用说明",
  content: [
    { tag: "title", text: "校园卡服务" },
    { tag: "text", text: "校园卡使用说明" },
  ],
  images: ["https://example.com/card.png"],
  cite: ["https://example.com/card-guide"],
  hidden: false,
} as const;

describe("pageConfigSchema 校验", () => {
  it("接受包含文本、列表与卡片的完整页面配置", () => {
    expect(pageConfigSchema.safeParse(validPageConfig).success).toBe(true);
  });

  it("缺少标题时在 title 上报错", () => {
    const { title: _title, ...config } = validPageConfig;
    const issues = getIssues(pageConfigSchema, config);

    expect(issues.map((issue) => issue.path)).toStrictEqual([["title"]]);
  });

  it("标题为空或超长时给出对应提示", () => {
    expect(getIssues(pageConfigSchema, { ...validPageConfig, title: "" })[0]).toMatchObject({
      path: ["title"],
      message: "页面标题不能为空",
    });
    expect(
      getIssues(pageConfigSchema, { ...validPageConfig, title: "a".repeat(31) })[0],
    ).toMatchObject({
      path: ["title"],
      message: "页面标题不能过长",
    });
  });

  it("content 为空数组或不是数组时在 content 上报错", () => {
    expect(getIssues(pageConfigSchema, { ...validPageConfig, content: [] })[0]?.path).toStrictEqual(
      ["content"],
    );
    expect(
      getIssues(pageConfigSchema, { ...validPageConfig, content: "not-an-array" })[0]?.path,
    ).toStrictEqual(["content"]);
  });

  it("非法组件在 content.0 上报错", () => {
    const issues = getIssues(pageConfigSchema, {
      ...validPageConfig,
      content: [{ tag: "list", items: [] }],
    });

    expect(issues[0]?.path.slice(0, 2)).toStrictEqual(["content", 0]);
  });

  it("非法日期在 time 上报错", () => {
    expect(
      getIssues(pageConfigSchema, { ...validPageConfig, time: "2025/03/01" })[0]?.path,
    ).toStrictEqual(["time"]);
  });

  it("未知字段会被 strictObject 拒绝", () => {
    const issues = getIssues(pageConfigSchema, {
      ...validPageConfig,
      unknownField: "x",
    });

    expect(issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    expect(issues.find((issue) => issue.code === "unrecognized_keys")?.path).toStrictEqual([]);
  });
});

describe("pageDataSchema 校验", () => {
  it("接受包含标题、ID、作者与内容的完整页面数据", () => {
    expect(pageDataSchema.safeParse(validPageData).success).toBe(true);
  });

  it("缺少 id 或 id 为空时在 id 上报错", () => {
    const { id: _id, ...data } = validPageData;

    expect(getIssues(pageDataSchema, data)[0]?.path).toStrictEqual(["id"]);
    expect(getIssues(pageDataSchema, { ...validPageData, id: "" })[0]?.path).toStrictEqual(["id"]);
  });

  it("author 只接受字符串", () => {
    expect(
      getIssues(pageDataSchema, { ...validPageData, author: ["后勤管理处"] })[0]?.path,
    ).toStrictEqual(["author"]);
  });

  it("content 为空数组时在 content 上报错", () => {
    expect(getIssues(pageDataSchema, { ...validPageData, content: [] })[0]?.path).toStrictEqual([
      "content",
    ]);
  });

  it("ai 专用字段不会进入页面数据 schema", () => {
    const issues = getIssues(pageDataSchema, {
      ...validPageData,
      aiPriority: 10,
      summary: "摘要",
      keywords: ["校园卡"],
    });

    expect(issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});

describe("pageContentSchema 校验", () => {
  it("接受多种组件", () => {
    const content = [
      { tag: "title", text: "标题" },
      { tag: "text", header: "段落", text: "正文" },
      { tag: "ul", text: ["甲", "乙"] },
      { tag: "doc", name: "申请表", url: "https://example.com/form.pdf" },
      { tag: "phone", fName: "老师", lName: "张", num: "0431-85099999" },
      { tag: "table", header: ["列"], body: [["值"]] },
      { tag: "action", header: "下载", content: "https://example.com/form.pdf" },
    ];

    expect(pageContentSchema.safeParse(content).success).toBe(true);
  });

  it("空内容数组给出明确提示", () => {
    const issues = getIssues(pageContentSchema, []);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toStrictEqual([]);
    expect(issues[0]?.message).toBe("页面内容不能为空");
  });

  it("非法组件在对应下标上报错", () => {
    const issues = getIssues(pageContentSchema, [{ tag: "title", text: "" }]);

    expect(issues[0]?.path.slice(0, 1)).toStrictEqual([0]);
  });
});

describe("locSchema 校验", () => {
  it.each(["45.123456,126.123456", "-90,-180", "0,0", "90,180", "45.0,126.0"])(
    "接受合法坐标 %s",
    (loc) => {
      expect(locSchema.safeParse(loc).success).toBe(true);
    },
  );

  it("纬度超出范围时给出纬度提示", () => {
    const issues = getIssues(locSchema, "91,126");

    expect(issues.some((issue) => /纬度.*-90 到 90/u.test(issue.message))).toBe(true);
  });

  it("经度超出范围时给出经度提示", () => {
    const issues = getIssues(locSchema, "45,-181");

    expect(issues.some((issue) => /经度.*-180 到 180/u.test(issue.message))).toBe(true);
  });

  it.each(["45.1234567,126", "45,126.1234567"])("拒绝超过 6 位小数的坐标 %s", (loc) => {
    const messages = getIssues(locSchema, loc).map((issue) => issue.message);

    expect(messages).toContain('位置应形如 "纬度,经度"，且每个坐标最多保留 6 位小数');
    expect(messages.some((message) => message.includes("最多保留 6 位小数"))).toBe(true);
  });

  it.each(["45, 126", "+45,126", "45", "abc,126"])("拒绝格式非法的坐标 %s", (loc) => {
    expect(locSchema.safeParse(loc).success).toBe(false);
  });
});

describe("marker schemas", () => {
  const validMarker = {
    name: "图书馆",
    loc: "45.123456,126.123456",
    detail: "本部校区图书馆",
    path: "guide/library",
  };

  it("markerConfigSchema 接受合法标记点", () => {
    expect(markerConfigSchema.safeParse(validMarker).success).toBe(true);
  });

  it("markerConfigSchema 拒绝空名称与非法坐标并指向对应字段", () => {
    expect(getIssues(markerConfigSchema, { ...validMarker, name: "" })[0]?.path).toStrictEqual([
      "name",
    ]);
    expect(getIssues(markerConfigSchema, { ...validMarker, loc: "91,126" })[0]?.path).toStrictEqual(
      ["loc"],
    );
  });

  it("markerConfigSchema 拒绝未知字段", () => {
    const issues = getIssues(markerConfigSchema, { ...validMarker, id: 1 });

    expect(issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });

  it("markerCategorySchema 拒绝空名称与空内容", () => {
    expect(
      getIssues(markerCategorySchema, { name: "", content: [validMarker] })[0]?.path,
    ).toStrictEqual(["name"]);
    expect(getIssues(markerCategorySchema, { name: "本部", content: [] })[0]?.path).toStrictEqual([
      "content",
    ]);
  });

  it("markersConfigSchema 接受多个分类并定位嵌套问题", () => {
    expect(
      markersConfigSchema.safeParse({
        campus: { name: "本部校区", content: [validMarker] },
        dorm: { name: "宿舍区", content: [validMarker] },
      }).success,
    ).toBe(true);

    expect(
      getIssues(markersConfigSchema, { campus: { name: "本部校区", content: [] } })[0]?.path,
    ).toStrictEqual(["campus", "content"]);
  });

  it("markerDataSchema 要求正整数 id", () => {
    expect(markerDataSchema.safeParse({ ...validMarker, id: 1 }).success).toBe(true);
    expect(getIssues(markerDataSchema, { ...validMarker, id: 0 })[0]?.path).toStrictEqual(["id"]);
    expect(getIssues(markerDataSchema, { ...validMarker, id: 1.5 })[0]?.path).toStrictEqual(["id"]);
    expect(getIssues(markerDataSchema, validMarker)[0]?.path).toStrictEqual(["id"]);
  });

  it("markersDataSchema 接受分类与标记点数据", () => {
    expect(
      markersDataSchema.safeParse({
        category: [{ path: "campus", name: "本部校区" }],
        marker: { campus: [{ ...validMarker, id: 1 }] },
      }).success,
    ).toBe(true);
  });

  it("markersDataSchema 定位分类与标记点中的非法字段", () => {
    expect(
      getIssues(markersDataSchema, {
        category: [{ path: "", name: "本部校区" }],
        marker: { campus: [{ ...validMarker, id: 1 }] },
      })[0]?.path,
    ).toStrictEqual(["category", 0, "path"]);

    expect(
      getIssues(markersDataSchema, {
        category: [{ path: "campus", name: "本部校区" }],
        marker: { campus: [{ ...validMarker, id: -1 }] },
      })[0]?.path,
    ).toStrictEqual(["marker", "campus", 0, "id"]);
  });
});
