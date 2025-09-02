import * as zod from "zod";

import {
  envListSchema,
  imageModeSchema,
  imgSchema,
  styleSchema,
} from "../../schema/common.js";

export const carouselSchema = zod
  .strictObject({
    tag: zod.literal("carousel"),
    /** swiper 展示的图片的在线网址或本地路径 */
    images: zod.array(imgSchema).min(1, "至少需要一张图片").meta({
      description: "swiper 展示的图片的在线网址或本地路径",
    }),
    /**
     * 轮播图是否填满屏幕宽度
     *
     * @default false
     */
    fill: zod
      .boolean()
      .meta({
        description: "轮播图是否填满屏幕宽度",
      })
      .optional(),
    /** swiper 的类名 */
    class: zod
      .string()
      .meta({
        description: "swiper 的类名",
      })
      .optional(),
    /** swiper 的样式 */
    style: styleSchema,
    /**
     * 面板指示点
     *
     * @default true
     */
    indicatorDots: zod
      .boolean()
      .meta({
        description: "面板指示点",
      })
      .optional(),
    /**
     * 指示点颜色
     *
     * @default '#ffffff88'
     */
    dotColor: zod
      .string()
      .meta({
        description: "指示点颜色",
      })
      .optional(),
    /**
     * 当前选中的指示点颜色
     *
     * @default '#fff'
     */
    dotActiveColor: zod
      .string()
      .meta({
        description: "当前选中的指示点颜色",
      })
      .optional(),
    /**
     * 自动切换
     *
     * @default true
     */
    autoplay: zod
      .boolean()
      .meta({
        description: "自动切换",
      })
      .optional(),
    /**
     * 自动切换时间间隔
     *
     * @default 5000
     */
    interval: zod
      .number()
      .min(0, "时间间隔不能为负数")
      .meta({
        description: "自动切换时间间隔",
      })
      .optional(),
    /**
     * 滑动动画时长
     *
     * @default 500
     */
    duration: zod
      .number()
      .min(0, "动画时长不能为负数")
      .meta({
        description: "滑动动画时长",
      })
      .optional(),
    /**
     * 衔接滑动
     *
     * @default true
     */
    circular: zod
      .boolean()
      .meta({
        description: "衔接滑动",
      })
      .optional(),
    /**
     * 是否是纵向滑动
     *
     * @default false
     */
    vertical: zod
      .boolean()
      .meta({
        description: "是否是纵向滑动",
      })
      .optional(),
    /** swiper 中图片的类名 */
    imgClass: zod
      .string()
      .meta({
        description: "swiper 中图片的类名",
      })
      .optional(),
    /** 图片的显示模式 */
    imgMode: imageModeSchema
      .meta({
        description: "图片的显示模式",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "carousel-component",
    description: "轮播图组件",
  });

export type CarouselComponentOptions = zod.infer<typeof carouselSchema>;

export interface CarouselComponentData
  extends Omit<CarouselComponentOptions, "style"> {
  /** 处理后的样式 */
  style?: string;
}

export const checkCarousel = (
  carousel: CarouselComponentOptions,
  location = "",
): void => {
  const result = carouselSchema.safeParse(carousel);

  if (!result.success) {
    console.error(
      `${location} 发现非法 carousel 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
