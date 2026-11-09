import { describe, expect, it } from "vitest";
import * as zod from "zod";

// Importing the library must not mutate the host application's zod config.
import { formatZodError } from "../src/helpers/validation.js";
import { checkPageContent } from "../src/page/schema.js";
import * as librarySchema from "../src/schema/index.js";

describe("zod locale", () => {
  it("should keep the default English messages for host schemas", () => {
    // The library schema itself is still usable after the import.
    expect(librarySchema.locSchema.safeParse("0,0").success).toBe(true);

    const result = zod.string().safeParse(1);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("expected string");
  });
});

describe("library validation messages", () => {
  it("should report validation errors in Chinese", () => {
    const issues = checkPageContent([{ tag: "text", text: 123 }] as never, "test-page");

    expect(issues.join("\n")).toMatch(/无效输入|期望/u);
    expect(issues.join("\n")).not.toMatch(/Invalid input|expected/u);
  });

  it("should format a standard zod issue with the exact Chinese locale text", () => {
    // 非 custom / invalid_union 分支：文案只由 zhCN locale 决定，
    // 与自定义 message 的处理逻辑（以及后续对它的改动）解耦。
    const result = zod.array(zod.string()).min(1).safeParse([]);

    expect(result.success).toBe(false);
    // 上一行已断言失败，`error` 必定存在；用断言避免在测试里写分支。
    expect(formatZodError(result.error as zod.ZodError)).toBe("✖ 数值过小：期望 array >=1 项");
  });
});
