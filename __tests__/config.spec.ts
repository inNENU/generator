import { describe, expect, it } from "vitest";

import { config, generatorConfig, resetConfig } from "../src/config.js";

describe(config, () => {
  it("只覆盖传入的字段，未传入字段保持默认值", () => {
    resetConfig();

    try {
      config({ assets: "https://assets.example.com/" });

      expect(generatorConfig.assets).toBe("https://assets.example.com");
      expect(generatorConfig.pageFolder).toBe("page");
      expect(generatorConfig.icon).toBe("");
    } finally {
      resetConfig();
    }
  });

  it("保留当前值并只更新指定字段", () => {
    resetConfig();
    config({ pageFolder: "pages", mapKey: "key" });

    try {
      config({ icon: "https://res.example.com/icons/" });

      expect(generatorConfig.pageFolder).toBe("pages");
      expect(generatorConfig.mapKey).toBe("key");
      expect(generatorConfig.icon).toBe("https://res.example.com/icons");
    } finally {
      resetConfig();
    }
  });

  it("resetConfig 恢复全部默认值", () => {
    config({ assets: "https://assets.example.com", pageFolder: "pages", mapKey: "key" });
    resetConfig();

    expect(generatorConfig).toStrictEqual({
      assets: "",
      icon: "",
      mapFolder: "",
      mapKey: "",
      pageFolder: "page",
    });
  });
});
