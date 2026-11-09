import * as zod from "zod";

import { useCompiled } from "../../helpers/compile.js";
import { collectZodIssues } from "../../helpers/validation.js";
import {
  channelProfileSchema,
  channelVideoSchema,
  envListSchema,
  miniProgramFullSchema,
  miniProgramShortLinkSchema,
  officialArticleSchema,
  officialProfileSchema,
  pathSchema,
  singleLineTextSchema,
  styleSchema,
  urlSchema,
} from "../../schema/common.js";
import { checkPagePath } from "../../utils.js";

const baseTextComponentSchema = zod.strictObject({
  /** 文字标签 */
  tag: zod.enum(["text", "p", "ol", "ul"]),
  /** 段落标题 */
  header: zod
    .union([singleLineTextSchema("段落标题"), zod.literal(false)])
    .meta({
      description: "段落标题",
    })
    .optional(),
  /** 段落文字 */
  text: zod
    .union([zod.string(), zod.array(zod.string())])
    .meta({
      description: "段落文字",
    })
    .optional(),
  /** 段落文字样式 */
  style: styleSchema,
  /**
   * 段落对齐方式
   *
   * @default "left"
   */
  align: zod
    .enum(["left", "right", "center", "justify"])
    .meta({
      description: "段落对齐方式",
    })
    .optional(),
  /** 环境列表 */
  env: envListSchema,
});

const plainTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  /**
   * 段落类型
   *
   * @default "none"
   */
  type: zod.literal("none").optional(),
});

const hintTextComponentSchema = zod.strictObject({
  ...baseTextComponentSchema.shape,
  /** 段落类型 */
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

/** 文本组件允许的标签 */
const textComponentTags = ["text", "p", "ol", "ul"] as const;

/** 文本组件的各种内容形态 */
const textComponentVariants = [
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
] as const;

/**
 * 文本组件
 *
 * 每种内容形态都按 `tag` 展开为字面量，使生成的 JSON Schema 可以按 `tag` 判别。
 */
export const textComponentSchema = zod
  .union(
    textComponentTags.flatMap((tag) =>
      textComponentVariants.map((variant) =>
        variant.extend({
          /** 文字标签 */
          tag: zod.literal(tag),
        }),
      ),
    ),
  )
  .meta({
    id: "text-component",
    description: "文本组件",
  });

export type BaseTextComponentOptions = zod.infer<typeof baseTextComponentSchema>;
export type PlainTextComponentOptions = zod.infer<typeof plainTextComponentSchema>;
export type HintTextComponentOptions = zod.infer<typeof hintTextComponentSchema>;
export type PathTextComponentOptions = zod.infer<typeof pathTextComponentSchema>;
export type PageTextComponentOptions = zod.infer<typeof pageTextComponentSchema>;
export type OfficialProfileTextComponentOptions = zod.infer<
  typeof officialProfileTextComponentSchema
>;
export type ChannelProfileTextComponentOptions = zod.infer<
  typeof channelProfileTextComponentSchema
>;
export type ArticleTextComponentOptions = zod.infer<typeof articleTextComponentSchema>;
export type VideoTextComponentOptions = zod.infer<typeof videoTextComponentSchema>;
export type MiniProgramTextComponentOptions = zod.infer<
  typeof miniProgramShortLinkTextComponentSchema | typeof miniProgramFullTextComponentSchema
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

export interface TextComponentData extends Omit<TextComponentOptions, "style" | "text"> {
  /** 段落文字 */
  text: string[];
  /** 段落样式 */
  style?: string;
}

export const checkText = (text: TextComponentOptions, location = "", pageId = ""): string[] => {
  const result = useCompiled(textComponentSchema).safeParse(text);
  const issues = result.success
    ? []
    : collectZodIssues(location, "发现非法 text 数据", result.error);

  // 检查跳转路径是否存在（排除小程序路径）
  if (
    pageId &&
    text &&
    typeof text === "object" &&
    "path" in text &&
    typeof text.path === "string" &&
    text.path &&
    !("appId" in text)
  )
    issues.push(...checkPagePath(text.path, pageId, location));

  return issues;
};
