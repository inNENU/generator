import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { checkAssets, ValidationError } from "../src/index.js";

const spyOnConsoleLog = (): MockInstance<typeof console.log> =>
  vi.spyOn(console, "log").mockImplementation(() => {});

interface TempContext {
  /** 临时根目录 */
  root: string;
  /** 捕获 `console.log` 的 spy，用于断言保留的日志输出 */
  log: ReturnType<typeof spyOnConsoleLog>;
}

const makeDir = (root: string, ...segments: string[]): string => {
  const dir = path.join(root, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const writeText = (filePath: string, content: string): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
};

const withTempRoot = (run: (context: TempContext) => void): void => {
  const root = mkdtempSync(path.join(tmpdir(), "checkAssets-"));
  const log = spyOnConsoleLog();

  try {
    run({ root, log });
  } finally {
    log.mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
};

describe(checkAssets, () => {
  it("accepts asset folder names containing an unmatched parenthesis", () => {
    withTempRoot(({ root }) => {
      const assets = makeDir(root, "assets(1");
      const pages = makeDir(root, "pages");
      const orphan = path.join(assets, "orphan.png");

      writeText(path.join(assets, "used.png"), "");
      writeText(orphan, "");
      writeText(path.join(pages, "page.yml"), `image: $${assets}/used.png\n`);

      expect(() => checkAssets([pages], [assets])).not.toThrow();
      expect(checkAssets([pages], [assets])).toStrictEqual([orphan]);
    });
  });

  it("evaluates global ignore rules without leaking lastIndex", () => {
    withTempRoot(({ root }) => {
      const assets = makeDir(root, "assets");
      const pages = makeDir(root, "pages");

      writeText(path.join(assets, "reports/a.png"), "");
      writeText(path.join(assets, "reports/b.png"), "");
      writeText(path.join(assets, "keep.png"), "");
      writeText(path.join(pages, "page.yml"), `image: $${assets}/keep.png\n`);

      expect(checkAssets([pages], [assets], [/reports/gu])).toStrictEqual([]);
    });
  });

  it("matches references carrying query strings and hashes", () => {
    withTempRoot(({ root }) => {
      const assets = makeDir(root, "assets");
      const pages = makeDir(root, "pages");

      writeText(path.join(assets, "cover.png"), "");
      writeText(path.join(assets, "avatar.png"), "");
      writeText(
        path.join(pages, "page.yml"),
        [`cover: $${assets}/cover.png?v=2`, `avatar: $${assets}/avatar.png#top`, ""].join("\n"),
      );

      expect(checkAssets([pages], [assets])).toStrictEqual([]);
    });
  });

  it("matches references followed by a YAML line comment", () => {
    withTempRoot(({ root }) => {
      const assets = makeDir(root, "assets");
      const pages = makeDir(root, "pages");

      writeText(path.join(assets, "cover.png"), "");
      writeText(path.join(assets, "orphan.png"), "");
      writeText(path.join(pages, "page.yml"), `cover: $${assets}/cover.png # 首页封面\n`);

      expect(checkAssets([pages], [assets])).toStrictEqual([path.join(assets, "orphan.png")]);
    });
  });

  it("scans .yaml pages in addition to .yml pages", () => {
    withTempRoot(({ root }) => {
      const assets = makeDir(root, "assets");
      const pages = makeDir(root, "pages");

      writeText(path.join(assets, "from-yaml.png"), "");
      writeText(path.join(assets, "from-yml.png"), "");
      writeText(path.join(pages, "page.yaml"), `image: $${assets}/from-yaml.png\n`);
      writeText(path.join(pages, "legacy.yml"), `image: $${assets}/from-yml.png\n`);

      expect(checkAssets([pages], [assets])).toStrictEqual([]);
    });
  });

  it("reports unused assets, keeps logging and supports strict mode", () => {
    withTempRoot(({ root, log }) => {
      const assets = makeDir(root, "assets");
      const pages = makeDir(root, "pages");
      const orphan = path.join(assets, "orphan.png");

      writeText(path.join(assets, "used.png"), "");
      writeText(orphan, "");
      writeText(path.join(pages, "page.yml"), `image: $${assets}/used.png\n`);

      expect(checkAssets([pages], [assets])).toStrictEqual([orphan]);
      expect(log).toHaveBeenCalledWith("未使用的资源:");
      expect(log).toHaveBeenCalledWith(orphan);
      expect(() => checkAssets([pages], [assets], [], true)).toThrow(ValidationError);
    });
  });
});
