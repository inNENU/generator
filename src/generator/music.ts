import { readFileSync, writeFileSync } from "node:fs";

import upath from "upath";

import type { LyricData, MusicList } from "./typings.js";
import { getFileList } from "../helpers/getFileList.js";
import { checkFile } from "../utils.js";

export const getMusicListJSON = (
  data: MusicList,
  location: string,
): MusicList => {
  data.forEach((item) => {
    checkFile(item.cover, location);
    checkFile(item.src, location);
  });

  return data;
};

export const generateLyrics = (lyricFolder: string, output: string): void => {
  console.log("生成歌词...");

  const lyricList = getFileList(lyricFolder, "lrc");

  lyricList.forEach((lyricPath) => {
    const lyricData: LyricData = [];

    const lyricLines = readFileSync(upath.join(lyricFolder, lyricPath), {
      encoding: "utf-8",
    }).split("\n");

    lyricLines.forEach((lyric) => {
      const result = /\[(.*)\](.*)?/u.exec(lyric);

      if (result) {
        const timeResult = /(.*):(.*)/u.exec(result[1]);

        if (timeResult) {
          /** 正确的时间 */
          const time = Number(
            (Number(timeResult[1]) * 60 + Number(timeResult[2])).toFixed(3),
          );

          lyricData.push({ time, text: result[2] });
        }
      }
    });

    writeFileSync(
      upath.join(output, lyricPath.replace(/lrc$/u, "json")),
      JSON.stringify(lyricData),
    );
  });

  console.info("歌词已生成");
};
