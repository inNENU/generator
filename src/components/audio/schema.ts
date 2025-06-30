import * as zod from "zod/v4";

import { envListSchema, fileSchema } from "../../schema/common.js";

export const audioSchema = zod.strictObject({
  tag: zod.literal("audio"),
  /** 媒体文件的在线网址或本地路径 */
  src: fileSchema,
  /** 音频名字 */
  name: zod.string().optional(),
  /** 音频作者 */
  author: zod.string().optional(),
  /** 音频封面 */
  poster: zod.string().optional(),
  /**
   * 是否自动播放
   *
   * @default false
   */
  autoplay: zod.boolean().optional(),
  /**
   * 是否循环播放
   *
   * @default false
   */
  loop: zod.boolean().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type AudioComponentOptions = zod.infer<typeof audioSchema>;

export const checkAudio = (
  audio: AudioComponentOptions,
  location = "",
): void => {
  try {
    audioSchema.parse(audio);
  } catch (error) {
    console.error(`${location} 发现非法 audio 数据:`, error);
  }
};
