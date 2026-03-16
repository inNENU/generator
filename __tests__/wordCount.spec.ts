import { describe, expect, it } from "vitest";

import { getJSONValue, getWordNumber } from "../src/helpers/wordCount.js";

describe(getWordNumber, () => {
  it("should count English words", () => {
    expect(getWordNumber("hello world")).toBe(2);
    expect(getWordNumber("one two three four five")).toBe(5);
  });

  it("should count Chinese characters", () => {
    expect(getWordNumber("你好世界")).toBe(4);
    expect(getWordNumber("中文")).toBe(2);
  });

  it("should count mixed content", () => {
    expect(getWordNumber("hello 你好 world")).toBe(4);
  });

  it("should return 0 for empty string", () => {
    expect(getWordNumber("")).toBe(0);
  });

  it("should count single word", () => {
    expect(getWordNumber("hello")).toBe(1);
  });

  it("should handle whitespace only", () => {
    expect(getWordNumber("   ")).toBe(0);
  });

  it("should handle punctuation between words", () => {
    expect(getWordNumber("hello, world")).toBe(2);
  });

  it("should handle Cyrillic characters", () => {
    expect(getWordNumber("Привет мир")).toBe(2);
  });
});

describe(getJSONValue, () => {
  it("should convert numbers to strings", () => {
    expect(getJSONValue(42)).toBe("42");
    expect(getJSONValue(3.14)).toBe("3.14");
  });

  it("should return strings as-is", () => {
    expect(getJSONValue("hello")).toBe("hello");
  });

  it("should handle arrays", () => {
    expect(getJSONValue(["a", "b", "c"])).toBe("a b c");
  });

  it("should handle nested objects", () => {
    const result = getJSONValue({ key1: "value1", key2: "value2" });

    expect(result).toContain("value1");
    expect(result).toContain("value2");
  });

  it("should handle null", () => {
    expect(getJSONValue(null)).toBe("");
  });

  it("should handle nested arrays and objects", () => {
    const result = getJSONValue({
      items: ["text1", "text2"],
      nested: { key: "value" },
    });

    expect(result).toContain("text1");
    expect(result).toContain("text2");
    expect(result).toContain("value");
  });

  it("should handle boolean values", () => {
    expect(getJSONValue(true)).toBe("");
    expect(getJSONValue(false)).toBe("");
  });

  it("should handle empty object", () => {
    expect(getJSONValue({})).toBe("");
  });
});
