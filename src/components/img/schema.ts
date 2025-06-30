import * as zod from "zod/v4";

import {
  envListSchema,
  imageModeSchema,
  imgSchema,
} from "../../schema/common.js";

export const imageSchema = zod.strictObject({
  tag: zod.literal("img"),
  /** 图片的本地路径或在线网址 */
  src: imgSchema,
  /** 图片的描述文字 */
  desc: zod.string().optional(),
  /**
   * 图片懒加载
   *
   * @default true
   */
  lazy: zod.literal(false).optional(),
  /**
   * 是否添加水印
   *
   * @default false
   */
  watermark: zod.boolean().optional(),
  /**
   * 图片显示模式
   *
   * @default "widthFix"
   */
  imgMode: imageModeSchema.optional(),
  /**
   * 是否支持长按弹出菜单
   *
   * @description 仅限微信小程序
   *
   * @default false
   */
  menu: zod.boolean().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type ImageComponentOptions = zod.infer<typeof imageSchema>;

export const checkImage = (
  image: ImageComponentOptions,
  location = "",
): void => {
  try {
    imageSchema.parse(image);
  } catch (error) {
    console.error(`${location} 发现非法 image 数据:`, error);
  }
};
