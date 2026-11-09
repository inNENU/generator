import { describe, expect, it, vi } from "vitest";

import type { MapPageConfig, MarkersConfig } from "../src/index.js";
import {
  getMapPageJSON,
  getMarkerJSON,
  getMarkersJSON,
  markersDataSchema,
  ValidationError,
} from "../src/index.js";

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

    expect(() => getMapPageJSON(config, "map/benbu/building/library")).toThrow(ValidationError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("发现非法地图页面配置"),
      // Zod 的报错文案随 locale 变化，这里只断言与语言无关的键名
      expect.stringContaining("bogus"),
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

    expect(() => getMapPageJSON(config, "map/benbu/building/library")).toThrow(ValidationError);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("中不存在"));

    errorSpy.mockRestore();
  });
});

describe(getMarkersJSON, () => {
  const validConfig: MarkersConfig = {
    benbu: {
      name: "本部",
      content: [
        { name: "图书馆", loc: "43.81234,125.33111" },
        { name: "食堂", loc: "43.81345,125.33222", detail: "本部食堂" },
      ],
    },
    jingyue: {
      name: "净月",
      content: [{ name: "教学楼", loc: "43.82111,125.42111" }],
    },
  };

  it("marker id 应从 1 开始连续递增，且生成结果通过 markersDataSchema 校验", () => {
    const result = getMarkersJSON(validConfig, "map", { check: false });

    expect(result.marker.all.map((marker) => marker.id)).toStrictEqual([1, 2, 3]);
    expect(result.marker.benbu.map((marker) => marker.id)).toStrictEqual([1, 2]);
    expect(result.marker.jingyue.map((marker) => marker.id)).toStrictEqual([3]);
    expect(result.category.map((item) => item.path)).toStrictEqual(["all", "benbu", "jingyue"]);

    // 回归点：id 从 0 开始时 markerDataSchema 的 positive 约束会失败
    expect(markersDataSchema.safeParse(result).success).toBe(true);

    // 单独生成 marker 时的默认 id 也必须是正整数
    expect(getMarkerJSON({ name: "图书馆", loc: "43.81234,125.33111" }, "map", "benbu").id).toBe(1);
  });

  it("分类 path 为保留名 all 时应抛错并指出冲突的 path", () => {
    const config: MarkersConfig = {
      all: {
        name: "自定义全部",
        content: [{ name: "图书馆", loc: "43.81234,125.33111" }],
      },
    };

    expect(() => getMarkersJSON(config, "map", { check: false })).toThrow(/"all"/u);
  });

  it("入口 check 流程应调用 checkMarkersConfig 拦截非法分类配置", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const config = {
      benbu: {
        name: "本部",
        bogus: "不应存在的键",
        content: [{ name: "图书馆", loc: "43.81234,125.33111" }],
      },
    } as unknown as MarkersConfig;

    expect(() => getMarkersJSON(config, "map")).toThrow(ValidationError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("发现非法标记点配置"),
      expect.stringContaining("未知的键"),
    );

    errorSpy.mockRestore();
  });
});
