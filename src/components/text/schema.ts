import * as zod from "zod";

import {
  channelProfileSchema,
  channelVideoSchema,
  envListSchema,
  miniProgramFullSchema,
  miniProgramShortLinkSchema,
  officialArticleSchema,
  officialProfileSchema,
  pathSchema,
  styleSchema,
  urlSchema,
} from "../../schema/common.js";

const baseTextComponentSchema = zod.strictObject({
  /** 文字标签 */
  tag: zod.enum(["text", "p", "ol", "ul"]),
  /** 段落标题 */
  header: zod.union([zod.string(), zod.literal(false)]).optional(),
  /** 段落文字 */
  text: zod.union([zod.string(), zod.array(zod.string())]).optional(),
  /** 段落文字样式 */
  style: styleSchema,
  /**
   * 段落对齐方式
   *
   * @default "left"
   */
  align: zod.enum(["left", "right", "center", "justify"]).optional(),
  /** 环境列表 */
  env: envListSchema,
});

const plainTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  /**
   * 段落类型
   *
   * @default 'none'
   */
  type: zod.literal("none").optional(),
});

const hintTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  /**
   * 段落类型
   */
  type: zod.enum(
    ["tip", "warning", "danger", "important", "info", "note"],
    "提示类型必须为 tip、warning、danger、important、info 或 note",
  ),
});

const pathTextComponentSchema = zod.strictObject({
  ...hintTextComponentSchema.shape,
  ...pathSchema.shape,
});

const pageTextComponentSchema = zod.strictObject({
  ...hintTextComponentSchema.shape,
  ...urlSchema.shape,
});

const miniProgramFullTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...miniProgramFullSchema.shape,
});

const miniProgramShortLinkTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...miniProgramShortLinkSchema.shape,
});

const officialProfileTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...officialProfileSchema.shape,
});

const channelProfileTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...channelProfileSchema.shape,
});

const articleTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...officialArticleSchema.shape,
});

const videoTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  ...channelVideoSchema.shape,
});

export const textComponentSchema = zod.union([
  plainTextComponentSchema,
  hintTextComponentSchema,
  pathTextComponentSchema,
  pageTextComponentSchema,
  officialProfileTextComponentSchema,
  channelProfileTextComponentSchema,
  articleTextComponentSchema,
  videoTextComponentSchema,
  miniProgramShortLinkTextComponentSchema,
  miniProgramFullTextComponentSchema,
]);

export type BaseTextComponentOptions = zod.infer<
  typeof baseTextComponentSchema
>;
export type PlainTextComponentOptions = zod.infer<
  typeof plainTextComponentSchema
>;
export type HintTextComponentOptions = zod.infer<
  typeof hintTextComponentSchema
>;
export type PathTextComponentOptions = zod.infer<
  typeof pathTextComponentSchema
>;
export type PageTextComponentOptions = zod.infer<
  typeof pageTextComponentSchema
>;
export type OfficialProfileTextComponentOptions = zod.infer<
  typeof officialProfileTextComponentSchema
>;
export type ChannelProfileTextComponentOptions = zod.infer<
  typeof channelProfileTextComponentSchema
>;
export type ArticleTextComponentOptions = zod.infer<
  typeof articleTextComponentSchema
>;
export type VideoTextComponentOptions = zod.infer<
  typeof videoTextComponentSchema
>;
export type MiniProgramTextComponentOptions = zod.infer<
  | typeof miniProgramShortLinkTextComponentSchema
  | typeof miniProgramFullTextComponentSchema
>;
export type TextComponentOptions =
  | PlainTextComponentOptions
  | HintTextComponentOptions
  | PathTextComponentOptions
  | PageTextComponentOptions
  | OfficialProfileTextComponentOptions
  | ChannelProfileTextComponentOptions
  | ArticleTextComponentOptions
  | VideoTextComponentOptions
  | MiniProgramTextComponentOptions;

export interface TextComponentData
  extends Omit<TextComponentOptions, "style" | "text"> {
  /** 段落文字 */
  text: string[];
  /** 段落样式 */
  style?: string;
}

export const checkText = (text: TextComponentOptions, location = ""): void => {
  const result = textComponentSchema.safeParse(text);

  if (!result.success) {
    console.error(
      `${location} 发现非法 text 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
