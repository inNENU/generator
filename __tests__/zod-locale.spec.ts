import { describe, expect, it } from "vitest";
import * as zod from "zod";

// Importing the library must not mutate the host application's zod config.
import { getPageJSON } from "../src/page/json.js";
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

    expect(() => getPageJSON({ title: 123, content: [] } as never, "test-page")).toThrow(
      /无效输入|期望|页面配置校验失败/u,
    );
  });
});
