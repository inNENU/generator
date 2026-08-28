import { readFileSync, writeFileSync } from "node:fs";

import { join } from "upath";

import { getFileList } from "../helpers/getFileList.js";
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
  if (check) checkMusicList(data, location);

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

    lyricLines.forEach((lyric) => {
      const result = /\[(?<time>.*)\](?<text>.*)?/u.exec(lyric);

      if (result) {
        const timeResult = /(?<minute>.*):(?<second>.*)/u.exec(result[1]);

        if (timeResult) {
          /** 正确的时间 */
          const time = Number((Number(timeResult[1]) * 60 + Number(timeResult[2])).toFixed(3));

          lyricData.push({ time, text: result[2] ?? "" });
        }
      }
    });

    writeFileSync(join(output, lyricPath.replace(/lrc$/u, "json")), JSON.stringify(lyricData));
  });

  console.info("歌词已生成");
};
