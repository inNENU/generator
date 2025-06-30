import * as zod from "zod/v4";

import { envListSchema, iconSchema, imgSchema } from "../../schema/common.js";

const baseCardSchema = zod.object({
  tag: zod.literal("card"),
  /** 卡片标题 */
  title: zod.string().min(1, "卡片标题不能为空"),
  /** 卡片描述 */
  desc: zod.string().optional(),
  /** 封面图片在线地址 */
  cover: imgSchema.optional(),
  /** 卡片 Logo 地址 */
  logo: iconSchema.optional(),
  /** 卡片 Logo 名称 */
  name: zod.string().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export const webCardSchema = baseCardSchema.extend({
  /** 跳转的链接 */
  url: zod.url({ protocol: /^https?$/ }),
});

export const pathCardSchema = baseCardSchema.extend({
  /** 跳转的文件名称 */
  path: zod.string().min(1, "路径不能为空"),
});

export const urlCardSchema = baseCardSchema.extend({
  /** 处理后的路径 */
  url: zod.string().min(1, "页面路径不能为空"),
});

export const miniProgramCardSchema = baseCardSchema.extend({
  /** 要打开的小程序 appId */
  appId: zod.string().min(1, "小程序 appId 不能为空"),
  /** 打开的页面路径 */
  path: zod.string().optional(),
  /** 需要传递给目标小程序的数据 */
  extraData: zod.record(zod.string(), zod.unknown()).optional(),
  /** 要打开的小程序版本 */
  versionType: zod.enum(["develop", "trial", "release"]).optional(),
});

export const cardSchema = zod.union([
  pathCardSchema,
  urlCardSchema,
  webCardSchema,
  miniProgramCardSchema,
]);

export type NormalCardComponentOptions = zod.infer<typeof webCardSchema>;
export type PageCardComponentOptions =
  | zod.infer<typeof pathCardSchema>
  | zod.infer<typeof urlCardSchema>;
export type MiniProgramCardComponentOptions = zod.infer<
  typeof miniProgramCardSchema
>;

export type CardComponentOptions =
  | MiniProgramCardComponentOptions
  | NormalCardComponentOptions
  | PageCardComponentOptions;

export const checkCard = (card: CardComponentOptions, location = ""): void => {
  try {
    cardSchema.parse(card);
  } catch (error) {
    console.error(`${location} 发现非法 card 数据:`, error);
  }
};
