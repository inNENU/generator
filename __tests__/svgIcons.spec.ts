import { existsSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

/**
 * 在生成前后对全局对象做快照，避免修复前的原型污染改脏测试进程、影响后续用例。
 *
 * @param run 测试用例
 */
const withPrototypeSnapshot = (run: () => void): void => {
  const snapshot = (target: object): Set<string> => new Set(Object.getOwnPropertyNames(target));

  const objectKeys = snapshot(Object);
  const prototypeKeys = snapshot(Object.prototype);
  const toStringKeys = snapshot(Object.prototype.toString);

  const restore = (target: object, originalKeys: Set<string>): void => {
    const addedKeys = Object.getOwnPropertyNames(target).filter((key) => !originalKeys.has(key));

    addedKeys.forEach((key) => {
      Reflect.deleteProperty(target, key);
    });
  };

  try {
    run();
  } finally {
    restore(Object, objectKeys);
    restore(Object.prototype, prototypeKeys);
    restore(Object.prototype.toString, toStringKeys);
  }
};

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
      const rainSvg = '<svg id="rain"/>';

      mkdirSync(path.join(sourceFolder, "weather"));
      writeFileSync(path.join(sourceFolder, "add.svg"), addSvg);
      writeFileSync(path.join(sourceFolder, "weather", "00-day.svg"), daySvg);
      writeFileSync(path.join(sourceFolder, "weather", "00-night.svg"), nightSvg);
      writeFileSync(path.join(sourceFolder, "weather", "rain.svg"), rainSvg);

      generateSvgIcons(sourceFolder, targetFolder);

      const weather = readCategory(targetFolder, "weather");

      expect(Object.keys(weather).sort()).toStrictEqual(["00-day", "00-night", "rain"]);
      expect(decode(weather["00-day"])).toBe(daySvg);
      expect(decode(weather["00-night"])).toBe(nightSvg);
      expect(decode(weather.rain)).toBe(rainSvg);

      const addUri = readFileSync(path.join(targetFolder, "add"), "utf-8");

      expect(decode(addUri)).toBe(addSvg);
    });
  });

  it("should keep a __proto__ category as an own category file", () => {
    withPrototypeSnapshot(() => {
      withFolders((sourceFolder, targetFolder) => {
        const aSvg = '<svg id="proto-a"/>';
        const bSvg = '<svg id="proto-b"/>';

        mkdirSync(path.join(sourceFolder, "__proto__"));
        writeFileSync(path.join(sourceFolder, "__proto__", "a.svg"), aSvg);
        writeFileSync(path.join(sourceFolder, "__proto__", "b.svg"), bSvg);

        generateSvgIcons(sourceFolder, targetFolder);

        // 修复前这里会把 data URI 写到 Object.prototype.a / Object.prototype.b。
        expect(Object.prototype).not.toHaveProperty("a");
        expect(Object.prototype).not.toHaveProperty("b");

        const categoryPath = path.join(targetFolder, "__proto__");

        expect(existsSync(categoryPath)).toBe(true);

        const category = JSON.parse(readFileSync(categoryPath, "utf-8")) as Record<string, string>;

        expect(Object.keys(category).sort()).toStrictEqual(["a", "b"]);
        expect(decode(category.a)).toBe(aSvg);
        expect(decode(category.b)).toBe(bSvg);
      });
    });
  });

  it("should keep __proto__ as an own key inside a category JSON", () => {
    withPrototypeSnapshot(() => {
      withFolders((sourceFolder, targetFolder) => {
        const normalSvg = '<svg id="weather-normal"/>';
        const protoSvg = '<svg id="weather-proto"/>';

        mkdirSync(path.join(sourceFolder, "weather"));
        writeFileSync(path.join(sourceFolder, "weather", "a.svg"), normalSvg);
        writeFileSync(path.join(sourceFolder, "weather", "__proto__.svg"), protoSvg);

        generateSvgIcons(sourceFolder, targetFolder);

        const weather = readCategory(targetFolder, "weather");

        expect(Object.keys(weather).sort()).toStrictEqual(["__proto__", "a"]);
        expect(Object.hasOwn(weather, "__proto__")).toBe(true);
        expect(Object.getPrototypeOf(weather)).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(weather, "__proto__")?.value).toBe(
          `${SVG_PREFIX}${encodeURIComponent(protoSvg)}`,
        );
        expect(decode(weather.a)).toBe(normalSvg);
      });
    });
  });

  it("should keep constructor and toString as normal category names", () => {
    withPrototypeSnapshot(() => {
      withFolders((sourceFolder, targetFolder) => {
        const wechatSvg = '<svg id="constructor-wechat"/>';
        const alipaySvg = '<svg id="constructor-alipay"/>';
        const closeSvg = '<svg id="tostring-close"/>';

        mkdirSync(path.join(sourceFolder, "constructor"));
        mkdirSync(path.join(sourceFolder, "toString"));
        writeFileSync(path.join(sourceFolder, "constructor", "wechat.svg"), wechatSvg);
        writeFileSync(path.join(sourceFolder, "constructor", "alipay.svg"), alipaySvg);
        writeFileSync(path.join(sourceFolder, "toString", "close.svg"), closeSvg);

        generateSvgIcons(sourceFolder, targetFolder);

        // 修复前会写到 Object 构造器与 Object.prototype.toString 上，且不生成分类文件。
        expect(Object).not.toHaveProperty("wechat");
        expect(Object.prototype.toString).not.toHaveProperty("close");

        const constructorCategory = readCategory(targetFolder, "constructor");

        expect(Object.keys(constructorCategory).sort()).toStrictEqual(["alipay", "wechat"]);
        expect(decode(constructorCategory.wechat)).toBe(wechatSvg);
        expect(decode(constructorCategory.alipay)).toBe(alipaySvg);

        const toStringCategory = readCategory(targetFolder, "toString");

        expect(Object.keys(toStringCategory)).toStrictEqual(["close"]);
        expect(decode(toStringCategory.close)).toBe(closeSvg);
      });
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
