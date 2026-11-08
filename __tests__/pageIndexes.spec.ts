import { describe, expect, it, vi } from "vitest";

import { getPageIndexesJSON } from "../src/generator/pageIndexes.js";
import { ValidationError } from "../src/helpers/validation.js";
import type { PageIndexes } from "../src/schema/index.js";

const validData: PageIndexes = [
  { name: "首页", icon: "https://example.com/icon.png", url: "/" },
  { name: "关于", icon: "https://example.com/about.png", url: "/about", tags: ["介绍"] },
];

const invalidData = [{ name: "", icon: "not-an-icon", url: "" }] as unknown as PageIndexes;

describe(getPageIndexesJSON, () => {
  it("默认校验合法数据，且不输出错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(getPageIndexesJSON(validData, "page-indexes")).toBe(validData);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("默认校验非法数据，抛出包含全部问题的 ValidationError", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const getError = (): unknown => {
        try {
          getPageIndexesJSON(invalidData, "page-indexes");

          return null;
        } catch (err) {
          return err;
        }
      };

      const err = getError();

      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.length).toBeGreaterThan(0);
      expect((err as ValidationError).message).toContain("page-indexes 页面索引校验失败");
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("check 为 false 时跳过校验，不抛错也不输出错误", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(getPageIndexesJSON(invalidData, "page-indexes", { check: false })).toBe(invalidData);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("check 为 true 时保持默认的校验行为", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => getPageIndexesJSON(invalidData, "page-indexes", { check: true })).toThrow(
        ValidationError,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
