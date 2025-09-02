import * as zod from "zod";

import { fileSchema, imgSchema } from "./common.js";

export const musicInfoSchema = zod
  .strictObject({
    /** 歌曲地址 */
    src: fileSchema.meta({
      description: "歌曲地址",
    }),
    /** 歌曲封面 */
    cover: imgSchema.meta({
      description: "歌曲封面",
    }),
    /** 标题 */
    title: zod.string().meta({
      description: "歌曲标题",
    }),
    /** 演唱者 */
    singer: zod.string().meta({
      description: "演唱者",
    }),
    /** 歌词 */
    lyric: zod
      .string()
      .meta({
        description: "歌词",
      })
      .optional(),
  })
  .meta({
    id: "music-info",
    description: "音乐信息",
  });

export const musicListSchema = zod.array(musicInfoSchema).meta({
  id: "music-list",
  description: "音乐列表",
});

export type MusicInfo = zod.infer<typeof musicInfoSchema>;

export type MusicList = zod.infer<typeof musicListSchema>;

export const checkMusicList = (
  data: MusicList,
  location: string,
): MusicList => {
  const result = musicListSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法音乐数据:`,
      zod.prettifyError(result.error),
    );
  }

  return data;
};
