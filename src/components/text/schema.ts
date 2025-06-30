import * as zod from "zod/v4";

import { envListSchema, styleSchema } from "../common.js";

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

const plainTextComponentSchema = baseTextComponentSchema.extend({
  /**
   * 段落类型
   *
   * @default 'none'
   */
  type: zod.literal("none").optional(),
});

const pathTextComponentSchema = baseTextComponentSchema.extend({
  /**
   * 段落类型
   */
  type: zod.enum(["tip", "warning", "danger", "info", "note"]),
  /**
   * 跳转到的路径
   */
  path: zod.string().optional(),
});

const urlTextComponentSchema = baseTextComponentSchema.extend({
  /**
   * 段落类型
   */
  type: zod.enum(["tip", "warning", "danger", "info", "note"]),
  /** 跳转的链接 */
  url: zod.string(),
});

const miniProgramTextComponentSchema = baseTextComponentSchema.extend({
  /** 要打开的小程序 appId */
  appId: zod.string().min(1, "小程序 appId 不能为空"),
  /** 打开的页面路径 */
  path: zod.string().optional(),
  /** 需要传递给目标小程序的数据 */
  extraData: zod.record(zod.string(), zod.unknown()).optional(),
  /** 要打开的小程序版本 */
  versionType: zod.enum(["develop", "trial", "release"]).optional(),
});

export const textComponentSchema = zod.union([
  plainTextComponentSchema,
  pathTextComponentSchema,
  urlTextComponentSchema,
  miniProgramTextComponentSchema,
]);

export type BaseTextComponentOptions = zod.infer<
  typeof baseTextComponentSchema
>;
export type PlainTextComponentOptions = zod.infer<
  typeof plainTextComponentSchema
>;
export type PathTextComponentOptions = zod.infer<
  typeof pathTextComponentSchema
>;
export type UrlTextComponentOptions = zod.infer<typeof urlTextComponentSchema>;
export type MiniProgramTextComponentOptions = zod.infer<
  typeof miniProgramTextComponentSchema
>;
export type TextComponentOptions = zod.infer<typeof textComponentSchema>;

export interface TextComponentData
  extends Omit<TextComponentOptions, "style" | "text"> {
  /** 段落文字 */
  text: string[];
  /** 段落样式 */
  style?: string;
}

export const checkText = (text: TextComponentOptions, location = ""): void => {
  try {
    textComponentSchema.parse(text);
  } catch (error) {
    console.error(`Invalid text data at ${location}:`, error);
  }
};
