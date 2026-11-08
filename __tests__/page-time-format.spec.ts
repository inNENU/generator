import { describe, expect, it } from "vitest";

import { getPageJSON } from "../src/page/json.js";
import type { PageConfig } from "../src/typings.js";

const buildPage = (time: string): PageConfig => ({
  title: "时间测试",
  time,
  content: [{ tag: "text", text: "hi" }],
});

describe("getPageJSON 时间格式化", () => {
  it("日期字符串只保留日期，不因 UTC 解析补出 08:00", () => {
    const pageData = getPageJSON(buildPage("2024-01-01"), "guide/time", [], { check: false });

    expect(pageData.time).toBe("2024 年 1 月 1 日");
  });

  it("零点后的时间不被当作 date-only 丢弃", () => {
    const pageData = getPageJSON(buildPage("2024-01-01 00:30:00"), "guide/time", [], {
      check: false,
    });

    expect(pageData.time).toBe("2024 年 1 月 1 日 00:30:00");
  });

  it("08:00 的时间保留完整时分秒", () => {
    const pageData = getPageJSON(buildPage("2024-01-01T08:00:00"), "guide/time", [], {
      check: false,
    });

    expect(pageData.time).toBe("2024 年 1 月 1 日 08:00:00");
  });

  it("无法解析的时间抛出带页面路径的错误", () => {
    expect(() => getPageJSON(buildPage("not-a-date"), "guide/time", [], { check: false })).toThrow(
      /guide\/time 页面处理失败: 无法解析页面时间: not-a-date/u,
    );
  });
});
