import { describe, expect, it } from "vitest";

import { locSchema } from "../src/schema/index.js";

const failures = (locs: string[]): string[] =>
  locs.filter((loc) => !locSchema.safeParse(loc).success);

const successes = (locs: string[]): string[] =>
  locs.filter((loc) => locSchema.safeParse(loc).success);

const messages = (loc: string): string => {
  const result = locSchema.safeParse(loc);

  return result.success ? "" : result.error.issues.map((issue) => issue.message).join("\n");
};

describe("location schema", () => {
  it("should accept valid coordinates", () => {
    expect(
      failures(["0,0", "45.123456,180", "-90,-180", "90,180", "-0.000001,0.000001"]),
    ).toStrictEqual([]);
  });

  it("should reject latitudes outside [-90, 90]", () => {
    expect(successes(["91,0", "-91,0", "-500,-500", "90.000001,0"])).toStrictEqual([]);
  });

  it("should reject longitudes outside [-180, 180]", () => {
    expect(successes(["0,181", "0,-181", "0,180.000001"])).toStrictEqual([]);
  });

  it("should reject more than 6 decimal places", () => {
    expect(successes(["0.1234567,0", "0,0.1234567", "45.0000001,180"])).toStrictEqual([]);
  });

  it("should reject malformed input", () => {
    expect(
      successes(["abc", "1,2,3", " 1,2", "1,2 ", "", ",", "1;2", "1e1,2", "+1,2", ".5,0", "1.,2"]),
    ).toStrictEqual([]);
  });

  it("should report helpful error messages", () => {
    expect(messages("91,0")).toContain("纬度");
    expect(messages("0,181")).toContain("经度");
    expect(messages("0.1234567,0")).toContain("6 位小数");
    expect(messages("1,2,3")).toContain("纬度,经度");
  });

  it("should keep a string type", () => {
    expect(locSchema.parse("0,0")).toBe("0,0");
  });
});
