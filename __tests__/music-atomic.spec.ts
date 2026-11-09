// oxlint-disable vitest/no-hooks -- 每个用例都需要重置 rename mock 并清理临时目录
// oxlint-disable vitest/prefer-import-in-mock -- 需要在用例内共享 rename mock 以断言原子写入
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import type * as NodeFs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { join as upathJoin, relative as upathRelative } from "upath";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateLyrics } from "../src/index.js";

/** 精简的 rename 签名，便于断言调用参数 */
type RenameSync = (oldPath: string, newPath: string) => void;

/**
 * 记录原子写入使用的 `rename` 调用，用于验证歌词输出确实经过「临时文件 + rename」。
 *
 * `node:fs` 的具名导出在模块加载时绑定，只有整体替换模块才能观察到调用。
 */
const fsMocks = vi.hoisted(() => ({
  actualRenameSync: undefined as unknown as RenameSync,
  renameSync: vi.fn<RenameSync>(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();

  fsMocks.actualRenameSync = actual.renameSync;
  fsMocks.renameSync.mockImplementation(actual.renameSync);

  return { ...actual, renameSync: fsMocks.renameSync };
});

interface Fixture {
  lyricFolder: string;
  outputFolder: string;
  testDir: string;
}

const createFixture = (lrc: string, filename = "song.lrc"): Fixture => {
  const testDir = mkdtempSync(path.join(tmpdir(), "innenu-music-atomic-"));
  const lyricFolder = path.join(testDir, "lyrics");
  const outputFolder = path.join(testDir, "output");

  mkdirSync(lyricFolder, { recursive: true });
  mkdirSync(outputFolder, { recursive: true });
  writeFileSync(path.join(lyricFolder, filename), lrc);

  return { lyricFolder, outputFolder, testDir };
};

const run = (fixture: Fixture): void => {
  generateLyrics(
    path.relative(process.cwd(), fixture.lyricFolder),
    path.relative(process.cwd(), fixture.outputFolder),
  );
};

describe("generateLyrics 原子写入", () => {
  const cleanups: string[] = [];

  afterEach(() => {
    for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true });
    fsMocks.renameSync.mockReset();
    fsMocks.renameSync.mockImplementation(fsMocks.actualRenameSync);
    vi.restoreAllMocks();
  });

  it("通过临时文件 + rename 写出歌词，成功后不残留临时文件", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fixture = createFixture("[00:01.00]原子写入");

    cleanups.push(fixture.testDir);

    try {
      run(fixture);

      // 目标路径由 generateLyrics 以相对路径拼接，这里用同样的方式推导
      // 实现使用 upath.join，断言同样用 upath 推导，避免 Windows 反斜杠导致误报
      const targetPath = upathJoin(upathRelative(process.cwd(), fixture.outputFolder), "song.json");

      // 先写临时文件再 rename 到目标路径
      expect(fsMocks.renameSync).toHaveBeenCalledWith(
        `${targetPath}.${process.pid}.tmp`,
        targetPath,
      );
      expect(readdirSync(fixture.outputFolder)).toStrictEqual(["song.json"]);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });

  it("rename 失败时抛出错误，且不落盘目标文件与临时文件", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fixture = createFixture("[00:01.00]失败路径", "broken.lrc");

    cleanups.push(fixture.testDir);

    try {
      fsMocks.renameSync.mockImplementationOnce(() => {
        throw new Error("rename failed");
      });

      expect(() => run(fixture)).toThrow("rename failed");
      expect(existsSync(path.join(fixture.outputFolder, "broken.json"))).toBe(false);
      expect(readdirSync(fixture.outputFolder)).toStrictEqual([]);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
