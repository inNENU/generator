import * as zod from "zod";

import {
  accountSchema,
  actionSchema,
  audioSchema,
  cardSchema,
  carouselSchema,
  docSchema,
  footerSchema,
  functionalListSchema,
  gridSchema,
  imageSchema,
  listSchema,
  locationSchema,
  phoneSchema,
  tableSchema,
  textComponentSchema,
  titleSchema,
  videoSchema,
} from "../components/schema.js";
import { iconSchema } from "../schema/common.js";

export const componentSchema = zod.union([
  accountSchema,
  actionSchema,
  audioSchema,
  cardSchema,
  carouselSchema,
  docSchema,
  footerSchema,
  functionalListSchema,
  gridSchema,
  imageSchema,
  listSchema,
  locationSchema,
  phoneSchema,
  tableSchema,
  textComponentSchema,
  titleSchema,
  videoSchema,
]);

export type ComponentOptions = zod.infer<typeof componentSchema>;

export const pageContentSchema = zod
  .array(componentSchema)
  .min(1, "页面内容不能为空");

export const checkPageContent = (
  content: ComponentOptions[],
  location: string,
): void => {
  const result = pageContentSchema.safeParse(content);

  if (!result.success) {
    console.error(
      `${location} 发现非法页面内容:`,
      zod.prettifyError(result.error),
    );
  }
};

export const pageTitleSchema = zod
  .string()
  .min(1, "页面标题不能为空")
  .max(30, "页面标题不能过长");

export const pageConfigSchema = zod.strictObject({
  /** 页面标题 */
  title: pageTitleSchema,
  /** 页面图标 */
  icon: iconSchema.optional(),
  /** 是否被 AI 忽略 */
  aiIgnore: zod.boolean().optional(),
  /** 页面标签 */
  tags: zod.array(zod.string()).optional(),
  /** 页面描述 */
  desc: zod.string().optional(),
  /** 页面作者 */
  author: zod.union([zod.array(zod.string()), zod.string()]).optional(),
  /** 页面最后更新时间 */
  time: zod.date().optional(),
  /** 页面标识 */
  id: zod.string().optional(),
  /** 是否是灰色背景 */
  grey: zod.boolean().optional(),
  /** 页面内容 */
  content: pageContentSchema,
  /**
   * 页面引用来源
   */
  cite: zod.union([zod.array(zod.string()), zod.string()]).optional(),
  /**
   * 页面内容是否已过时
   *
   * @default false
   */
  outdated: zod.boolean().optional(),
  /**
   * 是否可以使用小程序的界面分享
   *
   * @default false
   */
  shareable: zod.boolean().optional(),
  /**
   * 是否可以下载二维码
   *
   * @description Can download when shareable is true
   */
  qrcode: zod.union([zod.string(), zod.boolean()]).optional(),
  /**
   * 是否在分享弹出菜单中显示联系客服
   *
   * @default true
   */
  contact: zod.boolean().optional(),
});

export const pageDataSchema = zod.strictObject({
  /** 页面标题 */
  title: pageTitleSchema,
  /** 页面图标 */
  icon: iconSchema,
  /** 页面描述 */
  desc: zod.string().optional(),
  /** 页面作者 */
  author: zod.string().optional(),
  /** 页面最后更新时间 */
  time: zod.string().optional(),
  /** 页面标识 */
  id: zod.string().min(1, "页面ID不能为空"),
  /** 是否是灰色背景 */
  grey: zod.boolean().optional(),
  /** 页面内容 */
  content: pageContentSchema,
  /** 页面图片 */
  images: zod.array(zod.string()).optional(),
  /**
   * 页面引用来源
   */
  cite: zod.array(zod.string()).optional(),
  /**
   * 页面内容是否已过时
   *
   * @default false
   */
  outdated: zod.boolean().optional(),
  /**
   * 是否可以使用小程序的界面分享
   *
   * @default false
   */
  shareable: zod.boolean().optional(),
  /**
   * 是否可以下载二维码
   *
   * @description Can download when shareable is true
   */
  qrcode: zod.union([zod.string(), zod.boolean()]).optional(),
  /**
   * 是否在分享弹出菜单中显示联系客服
   *
   * @default true
   */
  contact: zod.boolean().optional(),
  /** 是否隐藏导航栏 */
  hidden: zod.boolean().optional(),
});

export type PageConfig = zod.infer<typeof pageConfigSchema>;
export type PageData = zod.infer<typeof pageDataSchema>;

export interface CheckPageConfigOptions {
  /**
   * 是否强制图标
   *
   * @default false
   */
  iconRequired?: boolean;
  /**
   * 是否强制标签
   *
   * @default false
   *
   */
  tagRequired?: boolean;
  /** 允许的标签 */
  allowedTags?: string[];
}

export const checkPageConfig = (
  config: PageConfig,
  location = "",
  options: CheckPageConfigOptions = {},
): void => {
  const result = pageConfigSchema.safeParse(config);

  if (!result.success) {
    console.error(
      `${location} 发现非法页面配置:`,
      zod.prettifyError(result.error),
    );
  }

  if (options.iconRequired && !config.icon) {
    console.error(`${location} 页面缺少图标`);
  }

  if (!config.aiIgnore) {
    if (options.allowedTags?.length) {
      config.tags?.forEach((tag) => {
        if (!options.allowedTags?.includes(tag))
          console.error(`${location} page contains illegal tag ${tag}`);
      });
    }

    if (options.tagRequired && !config.tags?.length) {
      console.error(`${location} 应包含标签`);
    }
  }
};

export const checkPageData = (data: PageData, location = ""): void => {
  const result = pageDataSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法页面数据:`,
      zod.prettifyError(result.error),
    );
  }
};
