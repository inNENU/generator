import * as zod from "zod/v4";

import { envListSchema, fileSchema, imgSchema } from "../../schema/common.js";

const danmuSchema = zod.strictObject({
  text: zod.string().min(1, "弹幕文字不能为空"),
  color: zod.string(),
  time: zod.number().min(0, "弹幕时间不能为负数"),
});

export const videoSchema = zod.strictObject({
  tag: zod.literal("video"),
  /** 媒体文件的在线网址或本地路径 */
  src: fileSchema,
  /** 视频的标题 */
  title: zod.string().optional(),
  /**
   * 是否循环播放
   *
   * @default false
   */
  loop: zod.boolean().optional(),
  /**
   * 是否显示默认控件
   *
   * @default true
   */
  controls: zod.boolean().optional(),
  /**
   * 视频封面的图片网络资源地址
   *
   * @description controls 为 false 时无效
   */
  poster: imgSchema.optional(),
  /**
   * 是否自动播放
   *
   * @default false
   */
  autoplay: zod.boolean().optional(),
  /** 视频初始播放位置 */
  startTime: zod.number().min(0, "开始时间不能为负数").optional(),
  /**
   * 是否显示弹幕按钮
   *
   * @description 只在初始化有效
   * @default true
   */
  danmuBtn: zod.boolean().optional(),
  /** 弹幕列表 */
  danmuList: zod.array(danmuSchema).optional(),
  /** 环境列表 */
  env: envListSchema,
});

// 类型导出
export type Danmu = zod.infer<typeof danmuSchema>;
export type VideoComponentOptions = zod.infer<typeof videoSchema>;

export const checkVideo = (
  video: VideoComponentOptions,
  location = "",
): void => {
  try {
    videoSchema.parse(video);
  } catch (error) {
    console.error(`${location} 发现非法 video 数据:`, error);
  }
};
