import * as zod from "zod";

import { fileSchema, imgSchema } from "./common.js";

export const musicInfoSchema = zod.strictObject({
  /** 歌曲地址 */
  src: fileSchema,
  /** 歌曲封面 */
  cover: imgSchema,
  /** 标题 */
  title: zod.string(),
  /** 演唱者 */
  singer: zod.string(),
  /** 歌词 */
  lyric: zod.string().optional(),
});

export const musicListSchema = zod.array(musicInfoSchema);

export type MusicInfo = zod.infer<typeof musicInfoSchema>;

export type MusicList = zod.infer<typeof musicListSchema>;

export const checkMusicList = (
  data: MusicList,
  location: string,
): MusicList => {
  try {
    zod.parse(musicListSchema, data);
  } catch (error) {
    console.error(`${location} 发现非法音乐数据:`, error);
  }

  return data;
};
