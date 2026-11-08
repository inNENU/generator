import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dirname, join } from "upath";

import { getFileList } from "../helpers/getFileList.js";
import { ValidationError } from "../helpers/validation.js";
import type { MusicList } from "../schema/index.js";
import { checkMusicList } from "../schema/index.js";
import type { LyricData } from "./typings.js";

/**
 * 获取音乐列表数据 JSON
 *
 * @param data 音乐列表数据
 * @param location 数据所在位置
 * @param check 是否进行完整性校验
 * @returns 音乐列表数据
 */
export const getMusicListJSON = (data: MusicList, location: string, check = true): MusicList => {
  if (check) {
    const issues = checkMusicList(data, location);

    if (issues.length) throw new ValidationError(`${location} 音乐列表校验失败`, issues);
  }

  return data;
};

/**
 * 将 lrc 歌词文件转换为 JSON 文件
 *
 * @param lyricFolder 歌词文件夹
 * @param output 输出文件夹
 */
export const generateLyrics = (lyricFolder: string, output: string): void => {
  console.log("生成歌词...");

  const lyricList = getFileList(lyricFolder, "lrc");

  lyricList.forEach((lyricPath) => {
    const lyricData: LyricData = [];

    const lyricLines = readFileSync(join(lyricFolder, lyricPath), {
      encoding: "utf-8",
    }).split("\n");

    /** 无法解析的行数，用于文件级汇总提示 */
    let skippedLines = 0;

    lyricLines.forEach((rawLine) => {
      const lyric = rawLine.replace(/\r$/u, "");

      // 空行直接跳过
      if (!lyric.trim()) return;

      // 跳过元数据 tag 行，如 [ti:]、[ar:]、[offset:]
      if (/^\[[a-zA-Z]+:/u.test(lyric)) {
        skippedLines += 1;
        return;
      }

      // 歌词行必须以一个或多个 [mm:ss.xx] 时间戳开头，后续为文本
      const result = /^(?<timestamps>(?:\[\d{1,3}:\d{2}(?:\.\d{1,3})?\])+)(?<text>.*)$/u.exec(
        lyric,
      );

      if (!result?.groups) {
        skippedLines += 1;
        return;
      }

      const { text, timestamps } = result.groups;

      // 一行可能带有多个时间戳，逐个展开
      for (const timestamp of timestamps.matchAll(
        /\[(?<minute>\d{1,3}):(?<second>\d{2}(?:\.\d{1,3})?)\]/gu,
      )) {
        /** 正确的时间 */
        const time = Number(
          (Number(timestamp.groups?.minute) * 60 + Number(timestamp.groups?.second)).toFixed(3),
        );

        lyricData.push({ time, text });
      }
    });

    if (skippedLines > 0) console.warn(`歌词 ${lyricPath} 中有 ${skippedLines} 行被跳过`);

    const outputPath = join(output, lyricPath.replace(/\.lrc$/u, ".json"));

    // 歌词可能位于源目录的子目录中，输出目录中的对应子目录可能尚不存在
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(lyricData));
  });

  console.info("歌词已生成");
};
