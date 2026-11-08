import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { LyricItem } from "../src/index.js";
import { generateLyrics } from "../src/index.js";

interface Fixture {
  lyricFolder: string;
  outputFolder: string;
  testDir: string;
}

const createFixture = (): Fixture => {
  const testDir = mkdtempSync(path.join(tmpdir(), "innenu-music-"));
  const lyricFolder = path.join(testDir, "lyrics");
  const outputFolder = path.join(testDir, "output");

  mkdirSync(lyricFolder, { recursive: true });
  mkdirSync(outputFolder, { recursive: true });

  return { lyricFolder, outputFolder, testDir };
};

const generate = (fixture: Fixture, lrc: string, filename = "song.lrc"): LyricItem[] => {
  const { lyricFolder, outputFolder } = fixture;

  writeFileSync(path.join(lyricFolder, filename), lrc);

  generateLyrics(
    path.relative(process.cwd(), lyricFolder),
    path.relative(process.cwd(), outputFolder),
  );

  const jsonPath = path.join(outputFolder, filename.replace(/\.lrc$/u, ".json"));

  return JSON.parse(readFileSync(jsonPath, "utf-8")) as LyricItem[];
};

describe(generateLyrics, () => {
  it("解析单时间戳、多时间戳与小数秒，并跳过元数据行", () => {
    const fixture = createFixture();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const lyrics = generate(
        fixture,
        [
          "[ti:测试歌曲]",
          "[ar:测试歌手]",
          "[al:测试专辑]",
          "[by:test]",
          "[offset:500]",
          "[00:12.34]第一行歌词",
          "[00:15.00][01:20.00]副歌",
          "[00:30.5]一位小数",
          "[01:15.50]",
          "[01:20.00][01:25.00][01:30.00]重复副歌",
        ].join("\n"),
      );

      // 5 行元数据不产生条目，剩下 5 行歌词共展开为 8 条
      expect(lyrics).toHaveLength(8);

      for (const lyric of lyrics) {
        expect(lyric.time).not.toBeNull();
        expect(Number.isFinite(lyric.time)).toBe(true);
      }

      expect(lyrics[0]).toStrictEqual({ time: 12.34, text: "第一行歌词" });

      // 同一行的多个时间戳按出现顺序展开
      expect(lyrics[1]).toStrictEqual({ time: 15, text: "副歌" });
      expect(lyrics[2]).toStrictEqual({ time: 80, text: "副歌" });

      expect(lyrics[3]).toStrictEqual({ time: 30.5, text: "一位小数" });

      // 空文本行也保留，且时间有效
      expect(lyrics[4]).toStrictEqual({ time: 75.5, text: "" });

      expect(lyrics.slice(5)).toStrictEqual([
        { time: 80, text: "重复副歌" },
        { time: 85, text: "重复副歌" },
        { time: 90, text: "重复副歌" },
      ]);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      rmSync(fixture.testDir, { recursive: true, force: true });
    }
  });

  it("元数据与无法解析的行不产生条目", () => {
    const fixture = createFixture();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const lyrics = generate(
        fixture,
        ["[ti:只有元数据]", "[ar:歌手]", "[not a timestamp]文本", "plain text", ""].join("\n"),
        "empty.lrc",
      );

      expect(lyrics).toStrictEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      rmSync(fixture.testDir, { recursive: true, force: true });
    }
  });
});

describe("generateLyrics 输出路径", () => {
  it("为源目录子目录中的歌词创建对应的输出子目录", () => {
    const fixture = createFixture();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      // 目录名与文件名中都含有 lrc，只有结尾的扩展名应被替换
      mkdirSync(path.join(fixture.lyricFolder, "lrc-archive"), { recursive: true });

      expect(() => generate(fixture, "[00:01.00]nested", "lrc-archive/song.lrc")).not.toThrow();

      const lyrics = JSON.parse(
        readFileSync(path.join(fixture.outputFolder, "lrc-archive", "song.json"), "utf-8"),
      ) as LyricItem[];

      expect(lyrics).toStrictEqual([{ time: 1, text: "nested" }]);
      expect(existsSync(path.join(fixture.outputFolder, "json-archive"))).toBe(false);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      rmSync(fixture.testDir, { recursive: true, force: true });
    }
  });

  it("只转换结尾为 .lrc 的文件", () => {
    const fixture = createFixture();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      // 非 .lrc 结尾的文件不应被选中，也不应产生输出
      writeFileSync(path.join(fixture.lyricFolder, "a.lrc.bak"), "[00:02.00]ignored");

      const lyrics = generate(fixture, "[00:01.00]kept", "lrc.lrc");

      expect(lyrics).toStrictEqual([{ time: 1, text: "kept" }]);
      expect(existsSync(path.join(fixture.outputFolder, "lrc.json"))).toBe(true);
      expect(existsSync(path.join(fixture.outputFolder, "a.lrc.json"))).toBe(false);
      expect(existsSync(path.join(fixture.outputFolder, "a.json"))).toBe(false);
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      rmSync(fixture.testDir, { recursive: true, force: true });
    }
  });
});
