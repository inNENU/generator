import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
