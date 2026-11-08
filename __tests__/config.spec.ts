import { describe, expect, it } from "vitest";

import { config, generatorConfig, resetConfig } from "../src/config.js";
import type { Config } from "../src/config.js";

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

  it("忽略值为 undefined 的字段", () => {
    resetConfig();
    config({ assets: "https://assets.example.com", pageFolder: "pages" });

    try {
      expect(() => config({ assets: undefined, icon: undefined })).not.toThrow();

      expect(generatorConfig.assets).toBe("https://assets.example.com");
      expect(generatorConfig.icon).toBe("");
      expect(generatorConfig.pageFolder).toBe("pages");
    } finally {
      resetConfig();
    }
  });

  it("同一调用中忽略 undefined 并应用其它字段", () => {
    resetConfig();
    config({ assets: "https://assets.example.com" });

    try {
      config({ assets: undefined, mapKey: "next-key" });

      expect(generatorConfig.assets).toBe("https://assets.example.com");
      expect(generatorConfig.mapKey).toBe("next-key");
    } finally {
      resetConfig();
    }
  });

  it("统一移除路径与 URL 末尾的多个斜杠", () => {
    resetConfig();

    try {
      config({
        assets: "https://assets.example.com///",
        icon: "https://res.example.com/icons//",
        mapFolder: "./data/function/map/",
        pageFolder: "./pages///",
      });

      expect(generatorConfig.assets).toBe("https://assets.example.com");
      expect(generatorConfig.icon).toBe("https://res.example.com/icons");
      expect(generatorConfig.mapFolder).toBe("./data/function/map");
      expect(generatorConfig.pageFolder).toBe("./pages");
    } finally {
      resetConfig();
    }
  });

  it("resetConfig 恢复全部默认值", () => {
    config({ assets: "https://assets.example.com", pageFolder: "pages", mapKey: "key" });
    resetConfig();

    const defaults: Config = {
      assets: "",
      icon: "",
      mapFolder: "",
      mapKey: "",
      pageFolder: "page",
    };

    expect(generatorConfig).toStrictEqual(defaults);
  });
});
