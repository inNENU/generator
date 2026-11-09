import { mkdirSync, readFileSync } from "node:fs";

import { dirname, join } from "upath";

import { writeFileAtomically } from "../helpers/generation-manifest.js";
import { getFileList } from "../helpers/getFileList.js";
import { ValidationError } from "../helpers/validation.js";
import type { MusicList } from "../schema/index.js";
import { checkMusicList } from "../schema/index.js";
import type { LyricData } from "./typings.js";

/**
 * LRC 元数据标签行，如 `[ar:歌手]`、`[ti:标题]`、`[offset:500]`
 *
 * 这类行不含时间戳，也不是歌词，属于正常元数据，解析时应静默忽略。
 *
 * 标签名首字符必须是字母，因此 `[00:12.34]` 这类时间戳行与 `[00:xx]` 这类坏时间戳行都不会被误判为元数据。
 */
const METADATA_LINE = /^(?:\[[a-zA-Z][\w-]*:[^[\]]*\])+$/u;

/** 歌词行：以一个或多个 `[mm:ss.xx]` 时间戳开头，后续为歌词文本 */
const LYRIC_LINE = /^(?<timestamps>(?:\[\d{1,3}:\d{2}(?:\.\d{1,3})?\])+)(?<text>.*)$/u;

/** 从时间戳行中提取单个 `[mm:ss.xx]` */
const TIMESTAMP = /\[(?<minute>\d{1,3}):(?<second>\d{2}(?:\.\d{1,3})?)\]/gu;

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
    })
      // 编辑器可能在文件开头写入 UTF-8 BOM，它属于文件元数据，不能算进第一行歌词
      .replace(/^\uFEFF/u, "")
      .split("\n");

    lyricLines.forEach((rawLine, index) => {
      const lyric = rawLine.replace(/\r$/u, "");

      // 空行直接跳过
      if (!lyric.trim()) return;

      // 元数据行（[ar:]、[ti:]、[offset:] 等）不是歌词，静默跳过
      if (METADATA_LINE.test(lyric.trim())) return;

      const result = LYRIC_LINE.exec(lyric);

      if (!result?.groups) {
        // 真正无法解析的行（如时间戳写错）保留警告，并带行号便于定位
        console.warn(`歌词 ${lyricPath} 第 ${index + 1} 行无法解析，已跳过: ${lyric}`);
        return;
      }

      const { text, timestamps } = result.groups;

      // 一行可能带有多个时间戳，逐个展开
      for (const timestamp of timestamps.matchAll(TIMESTAMP)) {
        /** 正确的时间 */
        const time = Number(
          (Number(timestamp.groups?.minute) * 60 + Number(timestamp.groups?.second)).toFixed(3),
        );

        lyricData.push({ time, text });
      }
    });

    const outputPath = join(output, lyricPath.replace(/\.lrc$/u, ".json"));

    // 歌词可能位于源目录的子目录中，输出目录中的对应子目录可能尚不存在
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileAtomically(outputPath, JSON.stringify(lyricData));
  });

  console.info("歌词已生成");
};
