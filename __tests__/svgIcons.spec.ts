import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateSvgIcons } from "../src/generator/svgIcons.js";
import { isCaseSensitiveFs } from "./caseSensitivity.js";

const SVG_PREFIX = "data:image/svg+xml,";

const decode = (uri: string): string => decodeURIComponent(uri.slice(SVG_PREFIX.length));

const withFolders = (run: (sourceFolder: string, targetFolder: string) => void): void => {
  const root = mkdtempSync(path.join(tmpdir(), "svg-icons-"));
  const sourceFolder = path.join(root, "source");
  const targetFolder = path.join(root, "target");

  mkdirSync(sourceFolder, { recursive: true });

  try {
    run(sourceFolder, targetFolder);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const readCategory = (targetFolder: string, category: string): Record<string, string> =>
  JSON.parse(readFileSync(path.join(targetFolder, category), "utf-8")) as Record<string, string>;

describe(generateSvgIcons, () => {
  it("should write percent-encoded data URIs for plain and categorized icons", () => {
    withFolders((sourceFolder, targetFolder) => {
      mkdirSync(path.join(sourceFolder, "weather"), { recursive: true });
      mkdirSync(path.join(sourceFolder, "brand"), { recursive: true });

      const addSvg = '<svg><path d="M0 0h10v10H0z"/></svg>';
      const sunSvg = "<svg><text>晴 café</text></svg>";
      const wechatSvg = '<svg fill="#00ff00"></svg>';

      writeFileSync(path.join(sourceFolder, "add.svg"), addSvg);
      writeFileSync(path.join(sourceFolder, "weather", "sun.svg"), sunSvg);
      writeFileSync(path.join(sourceFolder, "brand", "wechat.svg"), wechatSvg);

      generateSvgIcons(sourceFolder, targetFolder);

      const addUri = readFileSync(path.join(targetFolder, "add"), "utf-8");

      expect(addUri.startsWith(SVG_PREFIX)).toBe(true);
      expect(decode(addUri)).toBe(addSvg);

      const weather = readCategory(targetFolder, "weather");

      expect(decode(weather.sun)).toBe(sunSvg);

      const brand = readCategory(targetFolder, "brand");

      expect(decode(brand.wechat)).toBe(wechatSvg);
      expect(brand.wechat).not.toContain(";base64,");
    });
  });

  it("should aggregate multiple icons in one category", () => {
    withFolders((sourceFolder, targetFolder) => {
      const addSvg = '<svg><path d="M0 0h10v10H0z"/></svg>';
      const daySvg = "<svg><text>昼</text></svg>";
      const nightSvg = "<svg><text>夜</text></svg>";

      mkdirSync(path.join(sourceFolder, "weather"));
      writeFileSync(path.join(sourceFolder, "add.svg"), addSvg);
      writeFileSync(path.join(sourceFolder, "weather", "00-day.svg"), daySvg);
      writeFileSync(path.join(sourceFolder, "weather", "00-night.svg"), nightSvg);

      generateSvgIcons(sourceFolder, targetFolder);

      const weather = readCategory(targetFolder, "weather");

      expect(Object.keys(weather).sort()).toStrictEqual(["00-day", "00-night"]);
      expect(decode(weather["00-day"])).toBe(daySvg);
      expect(decode(weather["00-night"])).toBe(nightSvg);

      const addUri = readFileSync(path.join(targetFolder, "add"), "utf-8");

      expect(decode(addUri)).toBe(addSvg);
    });
  });

  it.skipIf(!isCaseSensitiveFs)(
    "should keep case-different icon names in one category as distinct keys",
    () => {
      withFolders((sourceFolder, targetFolder) => {
        const lowerSvg = '<svg id="lower"/>';
        const upperSvg = '<svg id="upper"/>';

        mkdirSync(path.join(sourceFolder, "weather"));
        writeFileSync(path.join(sourceFolder, "weather", "sun.svg"), lowerSvg);
        writeFileSync(path.join(sourceFolder, "weather", "Sun.svg"), upperSvg);

        generateSvgIcons(sourceFolder, targetFolder);

        const weather = readCategory(targetFolder, "weather");

        expect(Object.keys(weather).sort()).toStrictEqual(["Sun", "sun"]);
        expect(decode(weather.sun)).toBe(lowerSvg);
        expect(decode(weather.Sun)).toBe(upperSvg);
      });
    },
  );

  it("should keep single-icon output byte-identical to the previous format", () => {
    withFolders((sourceFolder, targetFolder) => {
      const addSvg = '<svg><path d="M0 0h10v10H0z"/></svg>';
      const sunSvg = "<svg><text>晴 café</text></svg>";

      mkdirSync(path.join(sourceFolder, "weather"));
      writeFileSync(path.join(sourceFolder, "add.svg"), addSvg);
      writeFileSync(path.join(sourceFolder, "weather", "sun.svg"), sunSvg);

      generateSvgIcons(sourceFolder, targetFolder);

      const expectedAdd = `${SVG_PREFIX}${encodeURIComponent(addSvg)}`;
      const expectedSun = `${SVG_PREFIX}${encodeURIComponent(sunSvg)}`;

      expect(readFileSync(path.join(targetFolder, "add"), "utf-8")).toBe(expectedAdd);
      expect(readFileSync(path.join(targetFolder, "weather"), "utf-8")).toBe(
        JSON.stringify({ sun: expectedSun }),
      );
    });
  });
});
