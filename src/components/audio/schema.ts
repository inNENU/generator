import * as zod from "zod";

import { envListSchema, fileSchema } from "../../schema/common.js";

export const audioSchema = zod
  .strictObject({
    tag: zod.literal("audio"),
    /** 媒体文件的在线网址或本地路径 */
    src: fileSchema.meta({
      description: "媒体文件的在线网址或本地路径",
    }),
    /** 音频名字 */
    name: zod
      .string()
      .meta({
        description: "音频名字",
      })
      .optional(),
    /** 音频作者 */
    author: zod
      .string()
      .meta({
        description: "音频作者",
      })
      .optional(),
    /** 音频封面 */
    poster: zod
      .string()
      .meta({
        description: "音频封面",
      })
      .optional(),
    /**
     * 是否自动播放
     *
     * @default false
     */
    autoplay: zod
      .boolean()
      .meta({
        description: "是否自动播放",
      })
      .optional(),
    /**
     * 是否循环播放
     *
     * @default false
     */
    loop: zod
      .boolean()
      .meta({
        description: "是否循环播放",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "audio-component",
    description: "音频组件",
  });

export type AudioComponentOptions = zod.infer<typeof audioSchema>;

export const checkAudio = (
  audio: AudioComponentOptions,
  location = "",
): void => {
  const result = audioSchema.safeParse(audio);

  if (!result.success) {
    console.error(
      `${location} 发现非法 audio 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
