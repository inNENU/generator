import { describe, expect, it, vi } from "vitest";

import { getActionJSON } from "../src/components/action/json.js";
import type { ActionComponentOptions } from "../src/components/action/schema.js";
import { getCardJSON } from "../src/components/card/json.js";
import type { CardComponentOptions } from "../src/components/card/schema.js";
import { getGridJSON } from "../src/components/grid/json.js";
import type { GridComponentOptions } from "../src/components/grid/schema.js";
import { getListJSON } from "../src/components/list/json.js";
import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "../src/components/list/schema.js";
import { getPhoneJSON } from "../src/components/phone/json.js";
import type { PhoneComponentOptions } from "../src/components/phone/schema.js";
import { getTextJSON } from "../src/components/text/json.js";
import type { PathTextComponentOptions } from "../src/components/text/schema.js";
import { getPageJSON } from "../src/page/json.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

/**
 * 递归冻结对象，任何写入都会在严格模式下抛出异常
 *
 * @param value 需要冻结的值
 * @returns 冻结后的值
 */
const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach((item) => {
      deepFreeze(item);
    });

    Object.freeze(value);
  }

  return value;
};

/**
 * 断言生成器不会修改传入的数据
 *
 * 会冻结原始数据、连续生成两次并比对结果与原始快照
 *
 * @param fixture 测试数据
 * @param run 生成函数
 * @returns 第一次生成的结果
 */
const expectPure = <T, R>(fixture: T, run: (value: T) => R): R => {
  const snapshot = structuredClone(fixture);
  const frozen = deepFreeze(fixture);

  const first = run(frozen);
  const second = run(frozen);

  expect(second).toStrictEqual(first);
  expect(frozen).toStrictEqual(snapshot);

  return first;
};

describe("component JSON generators are pure", () => {
  it("resolves a card path without modifying the card", () => {
    const card: CardComponentOptions = {
      tag: "card",
      title: "招生咨询",
      path: "contact",
    };

    const output = expectPure(card, (value) => getCardJSON(value, "guide/index"));

    expect(output).toMatchObject({ path: "guide/contact" });
  });

  it("resolves grid item paths without modifying the grid", () => {
    const grid: GridComponentOptions = {
      tag: "grid",
      header: "快速入口",
      items: [
        { text: "官网", icon: "https://example.com/icon.png", path: "website" },
        {
          text: "关于我们",
          icon: "https://example.com/icon.png",
          url: "https://example.com/about",
        },
      ],
    };

    const output = expectPure(grid, (value) => getGridJSON(value, "guide/index"));

    expect(output.items[0]).toMatchObject({ path: "guide/website" });
    expect(output.items[1]).toMatchObject({ url: "https://example.com/about" });
  });

  it("resolves list item paths without modifying the list", () => {
    const list: ListComponentOptions = {
      tag: "list",
      items: [
        { text: "联系方式", path: "contact" },
        { text: "官方网站", url: "https://example.com" },
      ],
    };

    const output = expectPure(list, (value) => getListJSON(value, "guide/index"));

    expect(output.items[0]).toMatchObject({ path: "guide/contact" });
  });

  it("injects functional list defaults on a copy", () => {
    const list: FunctionalListComponentOptions = {
      tag: "functional-list",
      items: [
        {
          type: "navigator",
          text: "切换到 inNENU",
          appId: "wx33acb831ee1831a5",
          path: "pages/index/index",
        },
        { type: "navigator", text: "联系方式", path: "contact" },
      ],
    };

    const output = expectPure(list, (value) => getListJSON(value, "guide/index"));

    expect(output.items[0]).toMatchObject({
      openType: "navigate",
      target: "miniProgram",
      // 外部小程序路径不应被解析为站内路径
      path: "pages/index/index",
    });
    expect(output.items[1]).toMatchObject({ openType: "navigate", path: "guide/contact" });
  });

  it("resolves a text path without modifying the text component", () => {
    const text: PathTextComponentOptions = {
      tag: "text",
      text: "查看详情",
      type: "tip",
      path: "contact",
    };

    const output = expectPure(text, (value) => getTextJSON(value, "guide/index"));

    expect(output).toMatchObject({ path: "guide/contact" });
    expect(output.text).toStrictEqual(["查看详情"]);
  });

  it("converts an action content on a copy", () => {
    const action: ActionComponentOptions = {
      tag: "action",
      content: "$file/notice.pdf",
    };

    const output = expectPure(action, (value) => getActionJSON(value));

    expect(output.content).toBe("/file/notice.pdf");
  });

  it("converts phone numbers on a copy", () => {
    const phone: PhoneComponentOptions = {
      tag: "phone",
      num: 13800138000,
      fName: "三",
      lName: "张",
    };

    const output = expectPure(phone, (value) => getPhoneJSON(value));

    expect(output.num).toBe("13800138000");
    expect(output.fName).toBe("三");
  });
});

describe("page generation is repeatable", () => {
  const createPage = (): PageConfig => ({
    title: "联系我们",
    desc: "全国招生咨询",
    content: [
      { tag: "title", text: "联系方式" },
      {
        tag: "text",
        text: "请通过以下方式联系我们",
        type: "tip",
        path: "contact",
      },
      {
        tag: "list",
        items: [{ text: "招生办公室", path: "contact" }],
      },
      {
        tag: "card",
        title: "招生办公室",
        path: "contact",
      },
    ],
  });

  it("keeps the page data and its markdown stable", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const page = createPage();
    const snapshot = structuredClone(page);
    const markdownBefore = getPageMarkdown(page);
    const textBefore = getPageText(page);

    deepFreeze(page);

    const pageData = getPageJSON(page, "guide/index", [], { check: false });
    const markdownAfter = getPageMarkdown(page);
    const textAfter = getPageText(page);

    // 生成 JSON 不应改变 Markdown 输出
    expect(markdownAfter).toBe(markdownBefore);
    expect(textAfter).toBe(textBefore);
    // 生成 JSON 不应修改页面配置
    expect(page).toStrictEqual(snapshot);
    // 重复生成结果一致，路径不会叠加
    expect(getPageJSON(page, "guide/index", [], { check: false })).toStrictEqual(pageData);

    expect(pageData.content[1]).toMatchObject({ path: "guide/contact" });
    expect(pageData.content[2]).toMatchObject({ items: [{ path: "guide/contact" }] });
    expect(pageData.content[3]).toMatchObject({ path: "guide/contact" });

    errorSpy.mockRestore();
  });
});
