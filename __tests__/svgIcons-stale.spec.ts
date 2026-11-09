import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { generateSvgIcons } from "../src/generator/svgIcons.js";

const MANIFEST_PREFIX = ".innenu-generated.svg.";

const SVG = '<svg><path d="M0 0h10v10H0z"/></svg>';

const createTempDir = (): string => mkdtempSync(path.join(tmpdir(), "svg-icons-stale-"));

const removeDir = (dir: string): void => rmSync(dir, { force: true, recursive: true });

const getManifestName = (dir: string): string => {
  const filename = readdirSync(dir).find(
    (name) => name.startsWith(MANIFEST_PREFIX) && name.endsWith(".json"),
  );

  if (!filename) throw new Error(`未找到 SVG 图标生成清单: ${dir}`);

  return filename;
};

interface GenerationManifest {
  version: number;
  files: string[];
}

const readManifest = (dir: string): GenerationManifest => {
  const manifestPath = path.join(dir, getManifestName(dir));

  return JSON.parse(readFileSync(manifestPath, "utf-8")) as GenerationManifest;
};

const writeManifest = (dir: string, files: readonly string[]): void => {
  writeFileSync(
    path.join(dir, getManifestName(dir)),
    `${JSON.stringify({ version: 1, files }, null, 2)}\n`,
  );
};

const getWarnings = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.map((call) => call.map(String).join(" "));

describe("svg 图标陈旧输出清理", () => {
  it("首次生成不删除已有文件，之后只删除清单内且本次未生成的产物", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(path.join(source, "weather"), { recursive: true });
      mkdirSync(path.join(source, "brand"), { recursive: true });
      mkdirSync(target, { recursive: true });

      writeFileSync(path.join(source, "add.svg"), SVG);
      writeFileSync(path.join(source, "weather", "sun.svg"), SVG);
      writeFileSync(path.join(source, "brand", "wechat.svg"), SVG);
      // 清单之外的已有文件：首次运行不得删除，后续也不得删除
      writeFileSync(path.join(target, "manual.json"), '{"manual":true}\n');
      writeFileSync(path.join(target, "legacy-icon"), "legacy");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        generateSvgIcons(source, target);

        expect(existsSync(path.join(target, "manual.json"))).toBe(true);
        expect(existsSync(path.join(target, "legacy-icon"))).toBe(true);
        expect(existsSync(path.join(target, "add"))).toBe(true);
        expect(existsSync(path.join(target, "weather"))).toBe(true);
        expect(existsSync(path.join(target, "brand"))).toBe(true);
        expect(readManifest(target).files).toStrictEqual(["add", "brand", "weather"]);

        // 源侧删除根图标与整个分类，新增一个分类
        rmSync(path.join(source, "add.svg"));
        rmSync(path.join(source, "weather"), { recursive: true });
        mkdirSync(path.join(source, "moon"));
        writeFileSync(path.join(source, "moon", "night.svg"), SVG);

        generateSvgIcons(source, target);
      } finally {
        warnSpy.mockRestore();
      }

      expect(existsSync(path.join(target, "add"))).toBe(false);
      expect(existsSync(path.join(target, "weather"))).toBe(false);
      expect(existsSync(path.join(target, "brand"))).toBe(true);
      expect(existsSync(path.join(target, "moon"))).toBe(true);
      expect(existsSync(path.join(target, "manual.json"))).toBe(true);
      expect(existsSync(path.join(target, "legacy-icon"))).toBe(true);
      expect(readManifest(target).files).toStrictEqual(["brand", "moon"]);
    } finally {
      removeDir(root);
    }
  });

  it("同一目标文件夹再次生成时保留分类内的共享输出", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(path.join(source, "weather"), { recursive: true });

      writeFileSync(path.join(source, "weather", "sun.svg"), SVG);
      writeFileSync(path.join(source, "weather", "rain.svg"), SVG);

      generateSvgIcons(source, target);

      const weatherBefore = readFileSync(path.join(target, "weather"), "utf-8");

      rmSync(path.join(source, "weather", "rain.svg"));
      generateSvgIcons(source, target);

      // 分类 JSON 不是陈旧文件，重写后不再包含已删除的图标
      expect(existsSync(path.join(target, "weather"))).toBe(true);
      expect(readFileSync(path.join(target, "weather"), "utf-8")).not.toBe(weatherBefore);
      expect(readFileSync(path.join(target, "weather"), "utf-8")).not.toContain("rain");
      expect(readManifest(target).files).toStrictEqual(["weather"]);
    } finally {
      removeDir(root);
    }
  });

  it("不跟随符号链接删除目标文件夹之外的文件", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      const outside = path.join(root, "outside");
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });
      mkdirSync(outside, { recursive: true });

      writeFileSync(path.join(source, "a.svg"), SVG);
      writeFileSync(path.join(outside, "keep.json"), '{"keep":true}\n');
      writeFileSync(path.join(outside, "victim.json"), '{"victim":true}\n');

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        generateSvgIcons(source, target);

        symlinkSync(outside, path.join(target, "linked"), "dir");

        // 模拟清单被篡改为一个经由符号链接指向目标文件夹之外的路径
        writeManifest(target, ["a", "linked/victim.json"]);

        generateSvgIcons(source, target);

        const warnings = getWarnings(warnSpy);

        expect(warnings.some((message) => message.includes("目标文件夹之外"))).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }

      expect(existsSync(path.join(outside, "keep.json"))).toBe(true);
      expect(existsSync(path.join(outside, "victim.json"))).toBe(true);
      expect(lstatSync(path.join(target, "linked")).isSymbolicLink()).toBe(true);
      expect(readManifest(target).files).toStrictEqual(["a"]);
    } finally {
      removeDir(root);
    }
  });
});
