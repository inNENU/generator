import { describe, expect, it } from "vitest";

import { camelCase2kebabCase } from "../src/utils.js";

describe(camelCase2kebabCase, () => {
  it("should convert camelCase to kebab-case", () => {
    const tests = [
      ["camelCase2kebabCase", "camel-case2kebab-case"],
      ["aBC", "a-b-c"],
      ["aWord", "a-word"],
    ];

    tests.forEach(([content, result]) => {
      expect(camelCase2kebabCase(content)).toBe(result);
    });
  });
});
