import { describe, expect, it, vi } from "vitest";

import { getVideoMarkdown } from "../src/components/video/markdown.js";
import { config, generatorConfig } from "../src/config.js";

const originalConfig = { ...generatorConfig };

const useAssets = (): void => {
  config({
    assets: "https://cdn.example.com/",
    icon: "",
    mapFolder: "",
    mapKey: "",
    pageFolder: "page",
  });
};

const restoreConfig = (): void => {
  Object.assign(generatorConfig, originalConfig);
};

describe(getVideoMarkdown, () => {
  it("resolves aliases in the video poster URL", () => {
    useAssets();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const markdown = getVideoMarkdown({
        tag: "video",
        src: "$file/a.mp4",
        poster: "$img/poster.png",
      });

      expect(markdown).toContain('poster="https://cdn.example.com/img/poster.png"');
      expect(markdown).toContain('src="https://cdn.example.com/file/a.mp4"');
      expect(markdown).not.toContain("$img");
    } finally {
      errorSpy.mockRestore();
      restoreConfig();
    }
  });

  it("escapes the poster attribute value", () => {
    const markdown = getVideoMarkdown({
      tag: "video",
      src: "https://cdn.example.com/a.mp4",
      poster: "https://cdn.example.com/poster.png?a=1&b=2",
    });

    expect(markdown).toContain('poster="https://cdn.example.com/poster.png?a=1&amp;b=2"');
  });

  it("omits the poster attribute when no poster is provided", () => {
    const markdown = getVideoMarkdown({
      tag: "video",
      src: "https://cdn.example.com/a.mp4",
    });

    expect(markdown).not.toContain("poster=");
  });
});
