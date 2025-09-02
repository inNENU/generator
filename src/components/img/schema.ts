import * as zod from "zod";

import {
  envListSchema,
  imageModeSchema,
  imgSchema,
} from "../../schema/common.js";

export const imageSchema = zod
  .strictObject({
    tag: zod.literal("img"),
    /** 图片的本地路径或在线网址 */
    src: imgSchema.meta({
      description: "图片的本地路径或在线网址",
    }),
    /** 图片的描述文字 */
    desc: zod
      .string()
      .meta({
        description: "图片的描述文字",
      })
      .optional(),
    /**
     * 图片懒加载
     *
     * @default true
     */
    lazy: zod
      .literal(false)
      .meta({
        description: "图片懒加载",
      })
      .optional(),
    /**
     * 是否添加水印
     *
     * @default false
     */
    watermark: zod
      .boolean()
      .meta({
        description: "是否添加水印",
      })
      .optional(),
    /**
     * 图片显示模式
     *
     * @default "widthFix"
     */
    imgMode: imageModeSchema
      .meta({
        description: "图片显示模式",
      })
      .optional(),
    /**
     * 是否支持长按弹出菜单
     *
     * @description 仅限微信小程序
     *
     * @default false
     */
    menu: zod
      .boolean()
      .meta({
        description: "是否支持长按弹出菜单",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "img-component",
    description: "图片组件",
  });

export type ImageComponentOptions = zod.infer<typeof imageSchema>;

export const checkImage = (
  image: ImageComponentOptions,
  location = "",
): void => {
  const result = imageSchema.safeParse(image);

  if (!result.success) {
    console.error(
      `${location} 发现非法 image 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
