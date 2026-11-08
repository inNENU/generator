import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { config, generatorConfig } from "../src/config.js";
import {
  checkPagePath,
  escapeHtml,
  convertStyle,
  getAssetIconLink,
  getHTMLPath,
  getMarkdownPath,
  resolvePath,
} from "../src/utils.js";

describe(getMarkdownPath, () => {
  it("should add .md extension", () => {
    expect(getMarkdownPath("guide/intro")).toBe("guide/intro.md");
  });

  it("should convert trailing slash to README.md", () => {
    expect(getMarkdownPath("guide/")).toBe("guide/README.md");
  });

  it("should convert /index to README.md", () => {
    expect(getMarkdownPath("guide/index")).toBe("guide/README.md");
  });

  it("should handle root path", () => {
    expect(getMarkdownPath("")).toBe(".md");
  });
});

describe(getHTMLPath, () => {
  it("should add .html extension", () => {
    expect(getHTMLPath("guide/intro")).toBe("guide/intro.html");
  });

  it("should keep trailing slash as-is", () => {
    expect(getHTMLPath("guide/")).toBe("guide/");
  });

  it("should convert /index to trailing slash", () => {
    expect(getHTMLPath("guide/index")).toBe("guide/");
  });
});

describe(getAssetIconLink, () => {
  it("should fall back to /assets when no assets directory is configured", () => {
    expect(getAssetIconLink("home")).toBe("/assets/icon/home.svg");
  });

  it("should use the configured assets directory", () => {
    config({
      assets: "https://assets.example.com/images",
      icon: "https://icons.example.com",
      mapFolder: "./map",
      mapKey: "key",
      pageFolder: "page",
    });

    try {
      expect(getAssetIconLink("home")).toBe("https://assets.example.com/images/icon/home.svg");
    } finally {
      config({ assets: "", icon: "", mapFolder: "", mapKey: "", pageFolder: "page" });
    }
  });
});

describe(convertStyle, () => {
  it("should return null for undefined", () => {
    expect(convertStyle()).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(convertStyle("")).toBeNull();
  });

  it("should return string styles as-is", () => {
    expect(convertStyle("color: red; font-size: 14px")).toBe("color: red; font-size: 14px");
  });

  it("should convert object styles to CSS string", () => {
    const result = convertStyle({ color: "red", fontSize: "14px" });

    expect(result).toContain("color:red;");
    expect(result).toContain("font-size:14px;");
  });

  it("should convert camelCase keys to kebab-case", () => {
    const result = convertStyle({ backgroundColor: "blue" });

    expect(result).toBe("background-color:blue;");
  });
});

describe(resolvePath, () => {
  it("should handle double slashes", () => {
    const result = resolvePath("guide//intro");

    expect(result).not.toContain("//");
  });

  it("should convert trailing slash to /index", () => {
    const result = resolvePath("guide/");

    expect(result).toContain("index");
  });

  it("should strip leading slash", () => {
    const result = resolvePath("/guide/intro");

    expect(result).not.toMatch(/^\//u);
  });
});

describe(checkPagePath, () => {
  it("should resolve page files from the configured page folder", () => {
    const pageFolder = mkdtempSync(path.join(tmpdir(), "innenu-check-page-"));
    const originalConfig = { ...generatorConfig };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      config({
        assets: "",
        icon: "",
        mapFolder: "",
        mapKey: "",
        pageFolder,
      });

      mkdirSync(path.join(pageFolder, "guide"), { recursive: true });
      writeFileSync(path.join(pageFolder, "guide", "foo.yml"), "title: foo\n");

      expect(checkPagePath("guide/foo", "index", "test")).toStrictEqual([]);
      expect(errorSpy).not.toHaveBeenCalled();

      const issues = checkPagePath("guide/missing", "index", "test");

      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("guide/missing");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("guide/missing"));
    } finally {
      errorSpy.mockRestore();
      Object.assign(generatorConfig, originalConfig);
      rmSync(pageFolder, { recursive: true, force: true });
    }
  });
});

describe(escapeHtml, () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });
});
