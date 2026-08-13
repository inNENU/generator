import { describe, expect, it, vi } from "vitest";

import type { MapPageConfig } from "../src/index.js";
import { getMapPageJSON } from "../src/index.js";

describe(getMapPageJSON, () => {
  it("含 photo 字段的地图配置不应触发重复校验误报，且 photo 应保留", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config: MapPageConfig = {
      title: "图书馆",
      photo: ["https://example.com/library.jpg"],
      content: [{ tag: "title", text: "图书馆" }],
    };

    const result = getMapPageJSON(config, "map/benbu/building/library");

    expect(errorSpy).not.toHaveBeenCalled();
    expect(result.photo).toStrictEqual(["https://example.com/library.jpg"]);
    expect(result.title).toBe("图书馆");

    errorSpy.mockRestore();
  });

  it("含未知键的地图配置仍会被 checkMapPageConfig 拦截", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config = {
      title: "图书馆",
      bogus: "不应存在的键",
      content: [{ tag: "title", text: "图书馆" }],
    } as unknown as MapPageConfig;

    getMapPageJSON(config, "map/benbu/building/library");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("发现非法地图页面配置"),
      expect.stringContaining("未知的键"),
    );

    errorSpy.mockRestore();
  });

  it("地图页的 list 路径存在性校验仍生效（组件级校验未被跳过）", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config: MapPageConfig = {
      title: "图书馆",
      content: [
        {
          tag: "list",
          items: [{ text: "测试", path: "guide/nonexistent-page-xyz" }],
        },
      ],
    };

    getMapPageJSON(config, "map/benbu/building/library");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("中不存在"));

    errorSpy.mockRestore();
  });
});
