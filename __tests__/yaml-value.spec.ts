import { JSON_SCHEMA, load } from "js-yaml";
import { describe, expect, it } from "vitest";

import { getYamlValue } from "../src/helpers/yaml.js";

/**
 * 把值写成 frontmatter 后再用 YAML 解析，模拟 VuePress 的行为
 *
 * @param value 待写入的值
 * @returns 解析后的值
 */
const roundTrip = (value: string): unknown => {
  const document = load(`value: ${getYamlValue(value)}`, { schema: JSON_SCHEMA }) as {
    value: unknown;
  };

  return document.value;
};

describe(getYamlValue, () => {
  it("quotes values that YAML would parse as non-strings", () => {
    const values = [
      "123",
      "true",
      "false",
      "null",
      "~",
      "0x1A",
      "0o17",
      "0b1010",
      "1e3",
      "-1.5",
      ".inf",
      "1_000",
      "2024-01-01",
      "2024-01-01 10:00:00",
    ];

    for (const value of values) {
      expect(getYamlValue(value)).toMatch(/^".*"$/u);
      expect(roundTrip(value)).toBe(value);
    }
  });

  it("keeps ordinary strings plain", () => {
    for (const value of ["关于 2024", "Hello world", "a-b", "C++", "v1.2.3"]) {
      expect(getYamlValue(value)).toBe(value);
      expect(roundTrip(value)).toBe(value);
    }
  });

  it("escapes quotes, backslashes and newlines", () => {
    for (const value of ['a"b', String.raw`a\b`, "a\nb", "a\rb"])
      expect(roundTrip(value)).toBe(value);
  });
});
