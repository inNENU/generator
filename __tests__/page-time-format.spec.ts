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

describe("getPageJSON 时间格式化不受构建机时区影响", () => {
  // oxlint-disable node/no-process-env -- 仅该辅助函数需要临时覆盖 TZ
  /**
   * 在指定时区下执行，结束后恢复原值
   *
   * @param timeZone 临时设置的时区
   * @param run 待执行的函数
   * @returns 函数的返回值
   */
  const runWithTimeZone = <T>(timeZone: string, run: () => T): T => {
    const previous = process.env.TZ;

    process.env.TZ = timeZone;

    try {
      return run();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  };
  // oxlint-enable node/no-process-env

  it("时区为 UTC 与 Asia/Shanghai 时同一 ISO 输入输出一致，且按东八区墙钟展示", () => {
    const inputs = [
      "2026-08-11T01:22:25.039Z",
      "2026-08-11T09:22:25+08:00",
      "2026-08-10T16:30:00Z",
      "2024-01-01 00:30:00",
      "2024-01-01T08:00:00",
    ];

    const formatAll = (): (string | undefined)[] =>
      inputs.map((time) => getPageJSON(buildPage(time), "guide/time", [], { check: false }).time);

    const inUTC = runWithTimeZone("UTC", formatAll);
    const inShanghai = runWithTimeZone("Asia/Shanghai", formatAll);

    expect(inUTC).toStrictEqual(inShanghai);
    expect(inUTC).toStrictEqual([
      "2026 年 8 月 11 日 09:22:25",
      "2026 年 8 月 11 日 09:22:25",
      "2026 年 8 月 11 日 00:30:00",
      "2024 年 1 月 1 日 00:30:00",
      "2024 年 1 月 1 日 08:00:00",
    ]);
  });

  it("日期字符串在任意时区下都只输出日期", () => {
    const formatDateOnly = (): string | undefined =>
      getPageJSON(buildPage("2024-01-01"), "guide/time", [], { check: false }).time;

    expect(runWithTimeZone("UTC", formatDateOnly)).toBe("2024 年 1 月 1 日");
    expect(runWithTimeZone("Asia/Shanghai", formatDateOnly)).toBe("2024 年 1 月 1 日");
    expect(runWithTimeZone("America/New_York", formatDateOnly)).toBe("2024 年 1 月 1 日");
  });
});
