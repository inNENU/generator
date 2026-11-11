import { JSON_SCHEMA, load } from "js-yaml";
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

  it("should quote strings containing double quotes", () => {
    const value = '@say "hello"';
    const quoted = getYamlValue(value);

    expect(quoted).toMatch(/^["']/u);
    expect((load(`value: ${quoted}`, { schema: JSON_SCHEMA }) as { value: unknown }).value).toBe(
      value,
    );
  });

  it("should not wrap plain strings", () => {
    expect(getYamlValue("simple")).toBe("simple");
  });

  it("should quote empty string so it round-trips as a string", () => {
    expect(getYamlValue("")).toBe('""');
    expect((load('value: ""', { schema: JSON_SCHEMA }) as { value: unknown }).value).toBe("");
  });
});
