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

describe("末尾斜杠规范化", () => {
  // 通过 `config()` 规范化 `assets` 并返回结果，避免直接依赖未导出的辅助函数
  const normalize = (assets: string): string => {
    resetConfig();

    try {
      config({ assets });

      return generatorConfig.assets;
    } finally {
      resetConfig();
    }
  };

  it("移除全部尾斜杠且不改动其它字符", () => {
    expect(normalize("https://a///")).toBe("https://a");
    expect(normalize("/a/")).toBe("/a");
    expect(normalize("a/b")).toBe("a/b");
    expect(normalize("/a/b")).toBe("/a/b");
    expect(normalize("a//b")).toBe("a//b");
    expect(normalize("///")).toBe("");
    expect(normalize("")).toBe("");
  });

  it("线性处理超长尾斜杠", () => {
    expect(normalize("/".repeat(200_000))).toBe("");
    expect(normalize(`x${"/".repeat(200_000)}`)).toBe("x");
  });

  it("病态输入不被回溯拖慢，且无尾斜杠时原样返回", () => {
    const pathological = `${"/".repeat(200_000)}x`;
    const start = performance.now();
    const result = normalize(pathological);
    const cost = performance.now() - start;

    // 末尾字符是 `x`，没有可移除的斜杠，长度与结尾内容都应保持原样
    expect(result).toHaveLength(pathological.length);
    expect(result.endsWith("/x")).toBe(true);
    // 多项式正则实现在该输入上约需 12s，线性实现通常 < 1ms，这里留足余量避免监测抖动
    expect(cost).toBeLessThan(1000);
  });
});
