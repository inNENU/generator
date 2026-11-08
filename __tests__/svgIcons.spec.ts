import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateSvgIcons } from "../src/generator/svgIcons.js";

const SVG_PREFIX = "data:image/svg+xml,";

const decode = (uri: string): string => decodeURIComponent(uri.slice(SVG_PREFIX.length));

describe(generateSvgIcons, () => {
  it("should write percent-encoded data URIs for plain and categorized icons", () => {
    const root = mkdtempSync(path.join(tmpdir(), "svg-icons-"));

    try {
      const sourceFolder = path.join(root, "source");
      const targetFolder = path.join(root, "target");

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

      const weather = JSON.parse(
        readFileSync(path.join(targetFolder, "weather"), "utf-8"),
      ) as Record<string, string>;

      expect(decode(weather.sun)).toBe(sunSvg);

      const brand = JSON.parse(readFileSync(path.join(targetFolder, "brand"), "utf-8")) as Record<
        string,
        string
      >;

      expect(decode(brand.wechat)).toBe(wechatSvg);
      expect(brand.wechat).not.toContain(";base64,");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
