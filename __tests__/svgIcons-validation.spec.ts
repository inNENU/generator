import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateSvgIcons } from "../src/generator/svgIcons.js";

const SVG = '<svg><path d="M0 0h1v1H0z"/></svg>';

describe("generateSvgIcons 布局校验", () => {
  const withFolders = (run: (sourceFolder: string, targetFolder: string) => void): void => {
    const root = mkdtempSync(path.join(tmpdir(), "svg-icons-validation-"));
    const sourceFolder = path.join(root, "source");
    const targetFolder = path.join(root, "target");

    mkdirSync(sourceFolder, { recursive: true });

    try {
      run(sourceFolder, targetFolder);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it("根图标与分类目录同名时抛错，而不是静默覆盖", () =>
    withFolders((sourceFolder, targetFolder) => {
      mkdirSync(path.join(sourceFolder, "weather"));
      writeFileSync(path.join(sourceFolder, "weather.svg"), SVG);
      writeFileSync(path.join(sourceFolder, "weather", "sun.svg"), SVG);

      expect(() => generateSvgIcons(sourceFolder, targetFolder)).toThrow(/图标输出名冲突/u);
    }));

  it("大小写不敏感的重名输出也抛错", () =>
    withFolders((sourceFolder, targetFolder) => {
      mkdirSync(path.join(sourceFolder, "Weather"));
      writeFileSync(path.join(sourceFolder, "weather.svg"), SVG);
      writeFileSync(path.join(sourceFolder, "Weather", "sun.svg"), SVG);

      expect(() => generateSvgIcons(sourceFolder, targetFolder)).toThrow(/图标输出名冲突/u);
    }));

  it("超过一层分类目录时抛错", () =>
    withFolders((sourceFolder, targetFolder) => {
      mkdirSync(path.join(sourceFolder, "brand/wechat"), { recursive: true });
      writeFileSync(path.join(sourceFolder, "brand/wechat/logo.svg"), SVG);

      expect(() => generateSvgIcons(sourceFolder, targetFolder)).toThrow(/不支持深层嵌套图标生成/u);
    }));
});
