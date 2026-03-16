import { describe, expect, it } from "vitest";

import { getYamlValue } from "../src/helpers/yaml.js";

describe(getYamlValue, () => {
  it("should return plain string as-is", () => {
    expect(getYamlValue("hello")).toBe("hello");
  });

  it("should wrap string starting with @ in quotes", () => {
    expect(getYamlValue("@mention")).toBe('"@mention"');
  });

  it("should wrap string containing colon-space in quotes", () => {
    expect(getYamlValue("key: value")).toBe('"key: value"');
  });

  it("should escape internal double quotes", () => {
    expect(getYamlValue('@say "hello"')).toBe(String.raw`"@say \"hello\""`);
  });

  it("should not wrap plain strings", () => {
    expect(getYamlValue("simple")).toBe("simple");
  });

  it("should handle empty string", () => {
    expect(getYamlValue("")).toBe("");
  });
});
