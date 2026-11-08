import { describe, expect, it } from "vitest";
import { z } from "zod";

import { useCompiled } from "../src/helpers/compile.js";

describe(useCompiled, () => {
  const schema = z.object({
    title: z.string().min(1),
    count: z.number().int().positive(),
  });

  it("compiles a schema into an equivalent parser", () => {
    const compiled = useCompiled(schema);

    // 返回编译副本而不是原 schema，但解析行为保持一致
    expect(compiled).not.toBe(schema);
    expect(compiled.parse({ title: "校园卡", count: 2 })).toStrictEqual({
      title: "校园卡",
      count: 2,
    });
  });

  it("caches the compiled schema per input schema", () => {
    expect(useCompiled(schema)).toBe(useCompiled(schema));

    // 不同 schema 实例各自编译，不复用缓存
    const firstSchema = z.object({ title: z.string() });
    const secondSchema = z.object({ title: z.string() });

    expect(useCompiled(firstSchema)).not.toBe(useCompiled(secondSchema));
  });

  it("reports issues with the same paths as the original schema", () => {
    const compiled = useCompiled(schema);
    const result = compiled.safeParse({ title: "", count: 0 }) as z.ZodSafeParseError<
      z.output<typeof schema>
    >;

    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.path)).toStrictEqual([["title"], ["count"]]);
    expect(result.error.issues.map((issue) => issue.code)).toStrictEqual([
      "too_small",
      "too_small",
    ]);
  });

  it("rejects values that do not match the schema", () => {
    const compiled = useCompiled(schema);

    expect(compiled.safeParse({ title: "校园卡", count: 2.5 }).success).toBe(false);
    expect(compiled.safeParse({ title: "校园卡" }).success).toBe(false);
    expect(compiled.safeParse("校园卡").success).toBe(false);
  });
});
