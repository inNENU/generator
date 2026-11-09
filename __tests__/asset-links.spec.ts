import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import type * as zod from "zod";

import { config, generatorConfig } from "../src/config.js";
import { formatZodError, ValidationError } from "../src/helpers/validation.js";
import { getPageJSON } from "../src/page/json.js";
import type { PageConfig } from "../src/page/schema.js";
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

/**
 * 读取 schema 校验失败后格式化给用户的文本
 *
 * @param schema 待校验的 schema
 * @param value 待校验的值
 * @returns 格式化后的错误文本，校验通过时返回空字符串
 */
const getFormattedError = (schema: zod.ZodType, value: unknown): string => {
  const result = schema.safeParse(value);

  return result.success ? "" : formatZodError(result.error);
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

  it("rejects relative path segments and drive letters as the asset root", () => {
    expect(resolveAssetLink("$../x.png")).toBeNull();
    expect(resolveAssetLink("$../../x")).toBeNull();
    expect(resolveAssetLink("$./x.png")).toBeNull();
    expect(resolveAssetLink(String.raw`$..\x.png`)).toBeNull();
    expect(resolveAssetLink("$C:/x.png")).toBeNull();
    expect(resolveAssetLink("$c:/x.png")).toBeNull();
    expect(resolveAssetLink("$img/%2e%2e/x.png")).toBeNull();
  });

  it("rejects percent-encoded separators", () => {
    for (const link of [
      "$img/%2E%2E%2f/x",
      "$img/%2e%2e%2fx",
      "$img/..%2f/x",
      "$..%2f/x",
      "$C:%2f/x",
      "$img/..%5cx",
      "$img/%2f/x",
      "$img/%5c/x",
    ])
      expect(resolveAssetLink(link)).toBeNull();
  });

  it("rejects percent-encoded dot segments even inside the asset root", () => {
    expect(resolveAssetLink("$img/sub/%2e%2e/x.png")).toBeNull();
    expect(resolveAssetLink("$img/%2e/x.png")).toBeNull();
    expect(resolveAssetLink("$%2e%2e/x.png")).toBeNull();
  });

  it("preserves percent-encoded file names and normalizes literal segments", () => {
    expect(resolveAssetLink("$img/a%20b.png")).toStrictEqual({
      root: "img",
      path: "img/a%20b.png",
      suffix: "",
    });
    expect(resolveAssetLink("$img/a%2eb.png")).toStrictEqual({
      root: "img",
      path: "img/a%2eb.png",
      suffix: "",
    });
    expect(resolveAssetLink("$img/%2e%2e.png")).toStrictEqual({
      root: "img",
      path: "img/%2e%2e.png",
      suffix: "",
    });
    expect(resolveAssetLink("$img//x.png")?.path).toBe("img/x.png");
    expect(resolveAssetLink("$img/./x.png")?.path).toBe("img/x.png");
    expect(resolveAssetLink("$img/sub/../x.png")?.path).toBe("img/x.png");
  });

  it("keeps encoded separators inside the query string and hash", () => {
    expect(resolveAssetLink("$img/a.png?next=%2f#%5c")).toStrictEqual({
      root: "img",
      path: "img/a.png",
      suffix: "?next=%2f#%5c",
    });
  });

  it("rejects whitespace roots and malformed percent encoding", () => {
    expect(resolveAssetLink("$ /x.png")).toBeNull();
    expect(resolveAssetLink("$%20/x.png")).toBeNull();
    expect(resolveAssetLink("$img/a%zz.png")).toBeNull();
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

  it("rejects internal links carrying percent-encoded separators", () => {
    withAssetTempRoot(() => {
      expect(getMessages(imgSchema, "$img/..%2fx.png")).toStrictEqual([
        "图片 $img/..%2fx.png 不是有效的资源路径",
      ]);
      expect(getMessages(fileSchema, "$file/..%5cx.pdf")).toStrictEqual([
        "文件 $file/..%5cx.pdf 不是有效的资源路径",
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

describe("资源错误信息格式化", () => {
  it("keeps the union branch message instead of the generic locale text", () => {
    withAssetTempRoot(() => {
      const detail = getFormattedError(imgSchema, "$img/missing.png");

      expect(detail).toContain("图片 $img/missing.png 不存在");
      expect(detail).not.toContain("无效输入");
    });
  });

  it("keeps superRefine messages for directly validated asset links", () => {
    withAssetTempRoot(() => {
      expect(getFormattedError(fileSchema, "$file/missing.pdf")).toContain(
        "文件 $file/missing.pdf 不存在",
      );
    });
  });

  it("reports concrete missing assets for page components", () => {
    withAssetTempRoot(() => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const page: PageConfig = {
          title: "测试页",
          desc: "测试",
          content: [
            { tag: "img", src: "$img/missing.png" },
            { tag: "doc", name: "文档", url: "$file/missing.pdf" },
            { tag: "audio", src: "$file/missing.mp3" },
            { tag: "carousel", images: ["$img/missing.png"] },
            { tag: "account", name: "主体", logo: "$img/missing.png" },
            {
              tag: "grid",
              items: [{ text: "项目", icon: "$img/missing.png", url: "https://example.com" }],
            },
          ],
        };

        const getThrownError = (): unknown => {
          try {
            getPageJSON(page, "guide/test");

            return null;
          } catch (err) {
            return err;
          }
        };

        const error = getThrownError();

        expect(error).toBeInstanceOf(ValidationError);

        const { message } = error as Error;

        expect(message).toContain("图片 $img/missing.png 不存在（位置: 0.src）");
        expect(message).toContain("文件 $file/missing.pdf 不存在（位置: 1.url）");
        expect(message).toContain("文件 $file/missing.mp3 不存在（位置: 2.src）");
        expect(message).toContain("图片 $img/missing.png 不存在（位置: 3.images.0）");
        expect(message).toContain("图片 $img/missing.png 不存在（位置: 4.logo）");
        expect(message).toContain("图片 $img/missing.png 不存在（位置: 5.items.0.icon）");
        expect(message).not.toContain("无效输入");
      } finally {
        errorSpy.mockRestore();
      }
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
        expect(checkFile("$../x.png", "guide")).toStrictEqual([
          "文件 $../x.png 不是有效的资源路径（位置: guide）",
        ]);
        expect(checkFile("$C:/x.png", "guide")).toStrictEqual([
          "文件 $C:/x.png 不是有效的资源路径（位置: guide）",
        ]);
        expect(errorSpy).toHaveBeenCalledTimes(4);
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  it("rejects percent-encoded separators in checkFile", () => {
    withAssetTempRoot(() => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        for (const link of [
          "$img/%2E%2E%2f/x",
          "$img/%2e%2e%2fx",
          "$img/..%2f/x",
          "$..%2f/x",
          "$C:%2f/x",
          "$img/..%5cx",
          "$img/%2f/x",
          "$img/%5c/x",
          "$ /x.png",
        ]) {
          const issues = checkFile(link, "guide");

          expect(issues).toHaveLength(1);
          expect(issues[0]).toContain("不是有效的资源路径");
        }

        expect(errorSpy).toHaveBeenCalledTimes(9);
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
    expect(getFileLink("$../x.png")).toBeNull();
    expect(getFileLink("$C:/x.png")).toBeNull();
  });

  it("returns null for percent-encoded separators", () => {
    for (const link of [
      "$img/%2E%2E%2f/x",
      "$img/%2e%2e%2fx",
      "$img/..%2f/x",
      "$..%2f/x",
      "$C:%2f/x",
      "$img/..%5cx",
      "$img/%2f/x",
      "$img/%5c/x",
      "$ /x.png",
    ])
      expect(getFileLink(link)).toBeNull();
  });

  it("keeps percent-encoded characters in generated links", () => {
    config({
      assets: "https://cdn.example.com/assets",
      icon: "",
      mapFolder: "",
      mapKey: "",
      pageFolder: "page",
    });

    try {
      expect(getFileLink("$img/a%20b.png")).toBe("https://cdn.example.com/assets/img/a%20b.png");
      expect(getFileLink("$img/a%2eb.png")).toBe("https://cdn.example.com/assets/img/a%2eb.png");
      expect(getFileLink("$img//x.png")).toBe("https://cdn.example.com/assets/img/x.png");
      expect(getFileLink("$img/./x.png")).toBe("https://cdn.example.com/assets/img/x.png");
    } finally {
      Object.assign(generatorConfig, originalConfig);
    }
  });

  it("returns external links unchanged", () => {
    expect(getFileLink("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(getFileLink()).toBeNull();
  });
});
