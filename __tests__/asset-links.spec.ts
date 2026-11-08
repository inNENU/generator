import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import type * as zod from "zod";

import { config, generatorConfig } from "../src/config.js";
import { fileSchema, imgSchema } from "../src/schema/common.js";
import { checkFile, getFileLink, resolveAssetLink } from "../src/utils.js";

/** 进入测试前的生成器配置 */
const originalConfig = { ...generatorConfig };

/**
 * 在临时资源目录中运行测试
 *
 * @param run 使用临时根目录的测试函数
 */
const withAssetTempRoot = (run: (root: string) => void): void => {
  const root = mkdtempSync(path.join(tmpdir(), "innenu-asset-links-"));
  const cwd = process.cwd();

  mkdirSync(path.join(root, "img"), { recursive: true });
  mkdirSync(path.join(root, "file"), { recursive: true });
  writeFileSync(path.join(root, "img", "a.png"), "");
  writeFileSync(path.join(root, "file", "guide.pdf"), "");

  process.chdir(root);

  try {
    run(root);
  } finally {
    process.chdir(cwd);
    Object.assign(generatorConfig, originalConfig);
    rmSync(root, { recursive: true, force: true });
  }
};

/**
 * 读取 schema 校验失败时的错误信息
 *
 * @param schema 待校验的 schema
 * @param value 待校验的值
 * @returns 错误信息列表
 */
const getMessages = (schema: zod.ZodType, value: unknown): string[] => {
  const result = schema.safeParse(value);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe(resolveAssetLink, () => {
  it("strips query strings and hashes while preserving the suffix", () => {
    expect(resolveAssetLink("$img/a.png?x=1#y")).toStrictEqual({
      root: "img",
      path: "img/a.png",
      suffix: "?x=1#y",
    });
  });

  it("normalizes backslashes and redundant path segments", () => {
    expect(resolveAssetLink(String.raw`$img\sub\..\a.png`)).toStrictEqual({
      root: "img",
      path: "img/a.png",
      suffix: "",
    });
  });

  it("supports an explicit absolute asset root", () => {
    withAssetTempRoot((root) => {
      const assets = path.join(root, "assets");

      expect(resolveAssetLink(`$${assets}/cover.png`, assets)).toStrictEqual({
        root: assets,
        path: `${assets}/cover.png`,
        suffix: "",
      });
    });
  });

  it("rejects links escaping the asset root", () => {
    expect(resolveAssetLink("$file/../x.pdf")).toBeNull();
    expect(resolveAssetLink("$img/../file/x.pdf")).toBeNull();
  });

  it("rejects non-asset links and bare asset roots", () => {
    expect(resolveAssetLink("https://example.com/a.png")).toBeNull();
    expect(resolveAssetLink("$img")).toBeNull();
    expect(resolveAssetLink("$img/")).toBeNull();
  });
});

describe("站内资源 schema", () => {
  it("accepts image links carrying query strings and hashes", () => {
    withAssetTempRoot(() => {
      expect(imgSchema.safeParse("$img/a.png?x=1#y").success).toBe(true);
    });
  });

  it("reports the missing image path instead of a generic union error", () => {
    withAssetTempRoot(() => {
      expect(getMessages(imgSchema, "$img/missing.png")).toStrictEqual([
        "图片 $img/missing.png 不存在",
      ]);
    });
  });

  it("rejects internal links escaping the asset root", () => {
    withAssetTempRoot(() => {
      expect(getMessages(fileSchema, "$file/../x.pdf")).toStrictEqual([
        "文件 $file/../x.pdf 不是有效的资源路径",
      ]);
    });
  });

  it("keeps HTTPS validation case-insensitive at runtime", () => {
    withAssetTempRoot(() => {
      expect(imgSchema.safeParse("HTTPS://EXAMPLE.COM/a.png").success).toBe(true);
      expect(getMessages(imgSchema, "http://example.com/a.png")).toStrictEqual([
        "图片 http://example.com/a.png 必须是 HTTPS 链接",
      ]);
    });
  });

  it("reports missing files with a Chinese message", () => {
    withAssetTempRoot(() => {
      expect(getMessages(fileSchema, "$file/missing.pdf")).toStrictEqual([
        "文件 $file/missing.pdf 不存在",
      ]);
    });
  });
});

describe(checkFile, () => {
  it("accepts existing assets with query strings and hashes", () => {
    withAssetTempRoot(() => {
      expect(checkFile("$img/a.png?x=1#y")).toStrictEqual([]);
    });
  });

  it("reports missing and escaping links in Chinese", () => {
    withAssetTempRoot(() => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        expect(checkFile("$img/missing.png", "guide")).toStrictEqual([
          "图片 $img/missing.png 不存在（位置: guide）",
        ]);
        expect(checkFile("$file/../x.pdf", "guide")).toStrictEqual([
          "文件 $file/../x.pdf 不是有效的资源路径（位置: guide）",
        ]);
        expect(errorSpy).toHaveBeenCalledTimes(2);
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});

describe(getFileLink, () => {
  it("keeps the query string and hash while prefixing configured assets", () => {
    config({
      assets: "https://cdn.example.com/assets",
      icon: "",
      mapFolder: "",
      mapKey: "",
      pageFolder: "page",
    });

    try {
      expect(getFileLink("$img/a.png?x=1#y")).toBe(
        "https://cdn.example.com/assets/img/a.png?x=1#y",
      );
    } finally {
      Object.assign(generatorConfig, originalConfig);
    }
  });

  it("returns null for links escaping the asset root", () => {
    expect(getFileLink("$file/../x.pdf")).toBeNull();
  });

  it("returns external links unchanged", () => {
    expect(getFileLink("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(getFileLink()).toBeNull();
  });
});
