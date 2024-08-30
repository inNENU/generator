import { readFileSync, writeFileSync } from "node:fs";

import { join } from "upath";

import type { LyricData, MusicList } from "./typings.js";
import { getFileList } from "../helpers/fs.js";
import { checkFile } from "../utils.js";

export const getMusicList = (data: MusicList, location: string): MusicList => {
  data.forEach((item) => {
    checkFile(item.cover, location);
    checkFile(item.src, location);
  });

  return data;
};

export const generateLyric = (lyricFolder: string, output: string): void => {
  console.log("Generating lyric...");

  const lyricList = getFileList(lyricFolder, ".lrc");

  lyricList.forEach((lyricPath) => {
    const lyricData: LyricData = [];

    const lyricLines = readFileSync(join(lyricFolder, lyricPath), {
      encoding: "utf-8",
    }).split("\n");

    lyricLines.forEach((lyric) => {
      const result = /\[(.*)\](.*)?/u.exec(lyric);

      if (result) {
        const timeResult = /(.*):(.*)/u.exec(result[1])!;
        /** 正确的时间 */
        const time = Number(
          (Number(timeResult[1]) * 60 + Number(timeResult[2])).toFixed(3),
        );

        lyricData.push({ time, text: result[2] });
      }
    });

    writeFileSync(
      join(output, lyricPath.replace(/lrc$/u, "json")),
      JSON.stringify(lyricData),
    );
  });

  console.info("Generated lyric!");
};