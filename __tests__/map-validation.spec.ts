// oxlint-disable vitest/no-hooks -- 每个用例都需要重置生成器配置并清理临时目录
// oxlint-disable promise/prefer-await-to-callbacks -- 同步断言抛错需要以回调形式调用被测函数
// oxlint-disable node/callback-return -- 回调抛出的异常在下方统一断言

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, resetConfig } from "../src/config.js";
import type { MapPageConfig, MarkersConfig, MarkerConfig } from "../src/index.js";
import { getMapPageJSON, getMarkerJSON, getMarkersJSON, ValidationError } from "../src/index.js";

/** 记录需要清理的临时目录 */
const tempFolders: string[] = [];

const createTempFolder = (): string => {
  const folder = mkdtempSync(path.join(tmpdir(), "innenu-map-validation-"));

  tempFolders.push(folder);

  return folder;
};

/**
 * 写入一个带 time 字段的最小地图页 YAML
 *
 * @param filePath YAML 文件路径
 */
const writeMapPageYAML = (filePath: string): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    "title: 图书馆\ntime: 2024-01-01\ncontent:\n  - tag: title\n    text: 图书馆\n",
    { encoding: "utf-8" },
  );
};

/**
 * 执行回调并断言抛出 ValidationError
 *
 * @param callback 期望抛错的操作
 * @returns 捕获到的 ValidationError
 */
const getValidationError = (callback: () => unknown): ValidationError => {
  let thrown: unknown;

  try {
    callback();
  } catch (err) {
    thrown = err;
  }

  expect(thrown).toBeInstanceOf(ValidationError);
  expect((thrown as ValidationError).name).toBe("ValidationError");

  return thrown as ValidationError;
};

describe("地图生成校验", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();

    for (const folder of tempFolders) rmSync(folder, { recursive: true, force: true });

    tempFolders.length = 0;
  });

  describe("地图页面校验结果", () => {
    it("非法页面内容应抛出 ValidationError，而不是只打印日志", () => {
      const page: MapPageConfig = {
        title: "图书馆",
        content: [
          {
            tag: "list",
            items: [{ text: "测试", path: "guide/nonexistent-page-xyz" }],
          },
        ],
      };

      const error = getValidationError(() =>
        getMapPageJSON(page, "function/map/benbu/building/library"),
      );

      expect(error.message).toContain("function/map/benbu/building/library 地图页面校验失败");
      expect(error.message).toContain("中不存在");
      expect(error.issues.length).toBeGreaterThan(0);
    });

    it("非法标题应抛出 ValidationError", () => {
      const page: MapPageConfig = {
        title: "",
        content: [{ tag: "title", text: "图书馆" }],
      };

      const error = getValidationError(() => getMapPageJSON(page, "map/benbu/building/library"));

      expect(error.message).toContain("map/benbu/building/library 地图页面校验失败");
      expect(error.message).toContain("位置: title");
    });

    it("check=false 时跳过输入校验，不因未知键抛错", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const page = {
        title: "图书馆",
        bogus: "不应存在的键",
        content: [{ tag: "title", text: "图书馆" }],
      } as unknown as MapPageConfig;

      const result = getMapPageJSON(page, "map/benbu/building/library", { check: false });

      expect(result.title).toBe("图书馆");
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("check=false 时跳过地图页 $img 与本地图标的存在性校验", () => {
      const page: MapPageConfig = {
        title: "图书馆",
        photo: ["$img/media/library.png"],
        content: [
          {
            tag: "card",
            title: "图书馆",
            logo: "$img/media/library.png",
            path: "benbu/building/library",
          },
          {
            tag: "list",
            items: [{ text: "图书馆", icon: "library" }],
          },
        ],
      };

      // 稀疏检出（无 img/、无 data/icon/）只校验输出形状，不访问资源文件
      const result = getMapPageJSON(page, "function/map/benbu/building/library", { check: false });

      expect(result.photo).toStrictEqual(["$img/media/library.png"]);
      expect(result.content[0]).toMatchObject({ logo: "$img/media/library.png" });
      expect(result.content[1]).toMatchObject({ items: [{ icon: "library" }] });
    });

    it("check=false 的资产跳过不会影响后续 check=true 的资产校验", () => {
      const page: MapPageConfig = {
        title: "图书馆",
        photo: ["$img/media/library.png"],
        content: [{ tag: "title", text: "图书馆" }],
      };

      expect(() =>
        getMapPageJSON(page, "function/map/benbu/building/library", { check: false }),
      ).not.toThrow();

      const error = getValidationError(() =>
        getMapPageJSON(page, "function/map/benbu/building/library"),
      );

      expect(error.message).toContain("地图页面校验失败");
    });

    it("check=false 也不允许产出不符合 mapPageDataSchema 的数据", () => {
      const page: MapPageConfig = {
        title: "",
        content: [{ tag: "title", text: "图书馆" }],
      };

      const error = getValidationError(() =>
        getMapPageJSON(page, "map/benbu/building/library", { check: false }),
      );

      expect(error.message).toContain("map/benbu/building/library 地图页面数据校验失败");
      expect(error.message).toContain("不符合 mapPageDataSchema");
      expect(error.message).toContain("位置: title");
    });

    it("页面目录与地图目录分离时，diffFiles 命中 mapFolder 中的源文件并更新 time", () => {
      const root = createTempFolder();
      const pageFolder = path.join(root, "pages");
      const mapFolder = path.join(root, "data/function/map");
      const pagePath = "function/map/benbu/building/library";
      const pageYAMLPath = path.join(mapFolder, "benbu/building/library.yml");

      mkdirSync(pageFolder, { recursive: true });
      writeMapPageYAML(pageYAMLPath);
      config({ pageFolder, mapFolder });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-05-01T12:00:00.000Z"));

      try {
        const page: MapPageConfig = {
          title: "图书馆",
          time: "2024-01-01",
          content: [{ tag: "title", text: "图书馆" }],
        };

        const result = getMapPageJSON(page, pagePath, {
          check: false,
          diffFiles: [pageYAMLPath],
        });

        expect(result.time).toMatch(/^2024 年 5 月 1 日/u);
        expect(readFileSync(pageYAMLPath, { encoding: "utf-8" })).toContain(
          `time: ${new Date("2024-05-01T12:00:00.000Z").toISOString()}`,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("相对 mapFolder 与前导 ./ 的 diffFiles 也能命中地图源文件", () => {
      const root = createTempFolder();
      const pageFolder = path.join(root, "pages");
      const mapFolder = path.join(root, "data/function/map");
      const pagePath = "function/map/benbu/building/library";
      const pageYAMLPath = path.join(mapFolder, "benbu/building/library.yml");
      const toRelative = (filePath: string): string =>
        `./${path.relative(process.cwd(), filePath).split(path.sep).join("/")}`;

      mkdirSync(pageFolder, { recursive: true });
      writeMapPageYAML(pageYAMLPath);
      config({ pageFolder, mapFolder: toRelative(mapFolder) });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-05-01T12:00:00.000Z"));

      try {
        const page: MapPageConfig = {
          title: "图书馆",
          time: "2024-01-01",
          content: [{ tag: "title", text: "图书馆" }],
        };

        const result = getMapPageJSON(page, pagePath, {
          check: false,
          diffFiles: [toRelative(pageYAMLPath)],
        });

        expect(result.time).toMatch(/^2024 年 5 月 1 日/u);
        expect(readFileSync(pageYAMLPath, { encoding: "utf-8" })).toContain(
          `time: ${new Date("2024-05-01T12:00:00.000Z").toISOString()}`,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("diffFiles 未命中地图源文件时保留配置中的 time，不写文件", () => {
      const root = createTempFolder();
      const pageFolder = path.join(root, "pages");
      const mapFolder = path.join(root, "data/function/map");
      const pagePath = "function/map/benbu/building/library";
      const pageYAMLPath = path.join(mapFolder, "benbu/building/library.yml");

      mkdirSync(pageFolder, { recursive: true });
      writeMapPageYAML(pageYAMLPath);
      config({ pageFolder, mapFolder });

      const page: MapPageConfig = {
        title: "图书馆",
        time: "2024-01-01",
        content: [{ tag: "title", text: "图书馆" }],
      };

      const result = getMapPageJSON(page, pagePath, {
        check: false,
        diffFiles: [path.join(mapFolder, "benbu/building/canteen.yml")],
      });

      expect(result.time).toBe("2024 年 1 月 1 日");
      expect(readFileSync(pageYAMLPath, { encoding: "utf-8" })).toContain("time: 2024-01-01");
    });

    it("mapFolder 中不存在源文件时 diffFiles 不抛错，也不更新 time", () => {
      const root = createTempFolder();
      const pageFolder = path.join(root, "pages");
      const mapFolder = path.join(root, "data/function/map");
      const pagePath = "function/map/benbu/building/library";

      mkdirSync(pageFolder, { recursive: true });
      config({ pageFolder, mapFolder });

      const page: MapPageConfig = {
        title: "图书馆",
        time: "2024-01-01",
        content: [{ tag: "title", text: "图书馆" }],
      };

      const result = getMapPageJSON(page, pagePath, {
        check: false,
        diffFiles: [path.join(mapFolder, "benbu/building/library.yml")],
      });

      expect(result.time).toBe("2024 年 1 月 1 日");
    });
  });

  describe("地图标记点校验结果", () => {
    it("非法 marker 配置应抛出 ValidationError", () => {
      const marker: MarkerConfig = { name: "", loc: "not-a-loc" };

      const error = getValidationError(() => getMarkerJSON(marker, "benbu", "building"));

      expect(error.message).toContain("benbu/building 地图标记点校验失败");
      expect(error.message).toContain("位置: name");
    });

    it("marker.path 指向的介绍页不存在时 check=true 应抛错", () => {
      config({ mapFolder: createTempFolder() });

      const marker: MarkerConfig = {
        name: "图书馆",
        loc: "43.81234,125.33111",
        path: "missing-page",
      };

      const error = getValidationError(() => getMarkerJSON(marker, "benbu", "building"));

      expect(error.message).toContain("benbu/building 地图标记点校验失败");
      expect(error.message).toContain("在 building/missing-page 中不存在");
    });

    it("check=false 时不检查 marker.path 是否存在，只拼接路径", () => {
      config({ mapFolder: createTempFolder() });

      const marker: MarkerConfig = {
        name: "图书馆",
        loc: "43.81234,125.33111",
        path: "missing-page",
      };

      expect(getMarkerJSON(marker, "benbu", "building", { check: false }).path).toBe(
        "building/missing-page",
      );
    });

    it("getMarkersJSON 应汇总所有 marker 的存在性问题后统一抛出", () => {
      config({ mapFolder: createTempFolder() });

      const markers: MarkersConfig = {
        building: {
          name: "建筑",
          content: [
            { name: "图书馆", loc: "43.81234,125.33111", path: "missing-1" },
            { name: "教学楼", loc: "43.81235,125.33112", path: "missing-2" },
          ],
        },
        canteen: {
          name: "食堂",
          content: [{ name: "食堂", loc: "43.81345,125.33222" }],
        },
      };

      const error = getValidationError(() => getMarkersJSON(markers, "benbu"));

      expect(error.message).toContain("benbu 地图标记点校验失败");
      expect(error.message).toContain("在 building/missing-1 中不存在");
      expect(error.message).toContain("在 building/missing-2 中不存在");
      expect(error.issues).toHaveLength(2);
    });
  });
});
