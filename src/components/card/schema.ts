import * as zod from "zod";

import {
  channelProfileSchema,
  channelVideoSchema,
  envListSchema,
  iconSchema,
  imgSchema,
  miniProgramFullSchema,
  miniProgramShortLinkSchema,
  officialArticleSchema,
  officialProfileSchema,
  pathSchema,
  urlSchema,
} from "../../schema/common.js";

const baseCardSchema = zod.strictObject({
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

export const pathCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...pathSchema.shape,
});

export const urlCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...urlSchema.shape,
});

export const officialProfileCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...officialProfileSchema.shape,
});

export const channelProfileCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...channelProfileSchema.shape,
});

export const articleCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...officialArticleSchema.shape,
});

export const videoCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...channelVideoSchema.shape,
});

export const miniProgramFullCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...miniProgramFullSchema.shape,
});

export const miniProgramShortLinkCardSchema = zod.strictObject({
  ...baseCardSchema.shape,
  ...miniProgramShortLinkSchema.shape,
});

export const cardSchema = zod.union([
  pathCardSchema,
  urlCardSchema,
  officialProfileCardSchema,
  channelProfileCardSchema,
  articleCardSchema,
  videoCardSchema,
  miniProgramFullCardSchema,
  miniProgramShortLinkCardSchema,
]);

export type NormalCardComponentOptions = zod.infer<typeof pathCardSchema>;
export type PageCardComponentOptions = zod.infer<typeof urlCardSchema>;
export type OfficialProfileCardComponentOptions = zod.infer<
  typeof officialProfileCardSchema
>;
export type ChannelProfileCardComponentOptions = zod.infer<
  typeof channelProfileCardSchema
>;
export type ArticleCardComponentOptions = zod.infer<typeof articleCardSchema>;
export type VideoCardComponentOptions = zod.infer<typeof videoCardSchema>;
export type MiniProgramCardComponentOptions = zod.infer<
  typeof miniProgramFullCardSchema | typeof miniProgramShortLinkCardSchema
>;
export type CardComponentOptions =
  | NormalCardComponentOptions
  | PageCardComponentOptions
  | MiniProgramCardComponentOptions
  | OfficialProfileCardComponentOptions
  | ChannelProfileCardComponentOptions
  | ArticleCardComponentOptions
  | VideoCardComponentOptions;

export const checkCard = (card: CardComponentOptions, location = ""): void => {
  const result = cardSchema.safeParse(card);

  if (!result.success) {
    console.error(
      `${location} 发现非法 card 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
