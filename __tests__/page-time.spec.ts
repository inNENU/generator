import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { config } from "../src/config.js";
import { getPageJSON, updatePageTime } from "../src/page/json.js";
import type { PageConfig } from "../src/page/schema.js";

interface PageFixture {
  pageFolder: string;
  pageYAMLPath: string;
}

const createPageFolder = (pageFolder: string, fileName: string, content: string): string => {
  const pageYAMLPath = path.join(pageFolder, "guide", `${fileName}.yml`);

  mkdirSync(path.join(pageFolder, "guide"), { recursive: true });
  writeFileSync(pageYAMLPath, content, { encoding: "utf-8" });

  return pageYAMLPath;
};

const setupPage = (content: string): PageFixture => {
  const pageFolder = mkdtempSync(path.join(tmpdir(), "innenu-page-time-"));

  config({
    assets: "https://example.com/assets/",
    icon: "https://example.com/icons/",
    mapFolder: path.join(pageFolder, "map"),
    mapKey: "test-key",
    pageFolder,
  });

  return {
    pageFolder,
    pageYAMLPath: createPageFolder(pageFolder, "about", content),
  };
};

describe("page time update", () => {
  it("在文件变更时原子更新源 YAML 的 time 字段", () => {
    const { pageFolder, pageYAMLPath } = setupPage(
      "title: 关于\ntime: 2024-01-01\ncontent:\n  - tag: text\n    text: hi\n",
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-01T12:00:00.000Z"));

    try {
      const page: PageConfig = {
        title: "关于",
        time: "2024-01-01",
        content: [{ tag: "text", text: "hi" }],
      };

      const pageData = getPageJSON(page, "guide/about", [pageYAMLPath], { check: false });
      const nextContent = readFileSync(pageYAMLPath, { encoding: "utf-8" });

      expect(nextContent).toContain(`time: ${new Date("2024-05-01T12:00:00.000Z").toISOString()}`);
      expect(nextContent).not.toContain("time: 2024-01-01");
      // UTC 12:00 对应上海墙钟 20:00，锁住按 Asia/Shanghai 输出的新格式化路径
      expect(pageData.time).toBe("2024 年 5 月 1 日 20:00:00");

      // 临时文件已被清理，目录内只剩页面文件
      expect(readdirSync(path.join(pageFolder, "guide"))).toStrictEqual(["about.yml"]);
    } finally {
      vi.useRealTimers();
      rmSync(pageFolder, { recursive: true, force: true });
    }
  });

  it("文件未变更时保留配置中的时间，不写文件", () => {
    const { pageFolder, pageYAMLPath } = setupPage(
      "title: 关于\ntime: 2024-01-01\ncontent:\n  - tag: text\n    text: hi\n",
    );

    try {
      const page: PageConfig = {
        title: "关于",
        time: "2024-01-01",
        content: [{ tag: "text", text: "hi" }],
      };

      const pageData = getPageJSON(page, "guide/about", [], { check: false });

      expect(pageData.time).toMatch(/^2024 年 1 月 1 日/u);
      expect(readFileSync(pageYAMLPath, { encoding: "utf-8" })).toContain("time: 2024-01-01");
    } finally {
      rmSync(pageFolder, { recursive: true, force: true });
    }
  });

  it("源 YAML 没有 time 字段时输出警告并跳过写入", () => {
    const { pageFolder, pageYAMLPath } = setupPage(
      "title: 关于\ncontent:\n  - tag: text\n    text: hi\n",
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const page: PageConfig = {
        title: "关于",
        time: "2024-01-01",
        content: [{ tag: "text", text: "hi" }],
      };

      getPageJSON(page, "guide/about", [pageYAMLPath], { check: false });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("不存在 time 字段"));
      expect(readFileSync(pageYAMLPath, { encoding: "utf-8" })).not.toContain("time:");
    } finally {
      warnSpy.mockRestore();
      rmSync(pageFolder, { recursive: true, force: true });
    }
  });

  it("页面 YAML 不存在时抛出带路径的错误", () => {
    const { pageFolder } = setupPage(
      "title: 关于\ntime: 2024-01-01\ncontent:\n  - tag: text\n    text: hi\n",
    );

    try {
      expect(() => updatePageTime(path.join(pageFolder, "guide", "missing.yml"))).toThrow(
        /页面文件不存在: .*missing\.yml/u,
      );
    } finally {
      rmSync(pageFolder, { recursive: true, force: true });
    }
  });
});
