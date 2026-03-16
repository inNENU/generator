import { describe, expect, it } from "vitest";

import {
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
  it("should return correct icon path", () => {
    expect(getAssetIconLink("home")).toBe("/assets/icon/home.svg");
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

    expect(result).not.toMatch(/^\//);
  });
});
