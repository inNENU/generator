import { existsSync } from "node:fs";

import * as zod from "zod";

zod.config(zod.locales.zhCN());

export const envSchema = zod.enum(["web", "wx", "qq", "app"]);

export const envListSchema = zod.array(envSchema).optional();

export const imageModeSchema = zod.enum([
  "widthFix",
  "scaleToFill",
  "aspectFit",
  "aspectFill",
  "top",
  "bottom",
  "center",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
]);

export const imageExtensionSchema = zod.enum([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".bmp",
  ".ico",
]);

export const docExtensionSchema = zod.enum([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

export const internalImgSchema = zod
  .templateLiteral(["$img/", zod.string(), imageExtensionSchema])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: "文件不存在",
    abort: true,
  }) as unknown as zod.ZodString;

export const internalDocsSchema = zod
  .templateLiteral(["$file/", zod.string(), docExtensionSchema])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: "文件不存在",
    abort: true,
  }) as unknown as zod.ZodString;

export const internalFileSchema = zod
  .templateLiteral(["$file/", zod.string()])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: "文件不存在",
    abort: true,
  }) as unknown as zod.ZodString;

export const httpsLinkSchema = zod.url({ protocol: /^https$/ });

export const imgSchema = zod.union([internalImgSchema, httpsLinkSchema]);
export const fileSchema = zod.union([internalFileSchema, httpsLinkSchema]);

export const internalIconSchema = zod
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "图标名称只能包含小写字母、数字和连字符",
  )
  .refine((icon) => existsSync(`./data/icon/${icon}.svg`), {
    error: "图标文件不存在",
    abort: true,
  });

export const iconSchema = zod.union([internalIconSchema, imgSchema]);

export const locSchema = zod.templateLiteral([
  zod
    .number()
    .refine(
      (value) => value >= -180 && value <= 180,
      "纬度必须在 -180 到 180 之间",
    )
    .refine((value) => !Number.isInteger(value * 1e4), "纬度至少 5 位小数"),
  ",",
  zod
    .number()
    .refine(
      (value) => value >= -180 && value <= 180,
      "经度必须在 -180 到 180 之间",
    )
    .refine((value) => !Number.isInteger(value * 1e4), "经度至少 5 位小数"),
]);

export const styleSchema = zod
  .union([zod.string(), zod.record(zod.string(), zod.string())])
  .optional();

export const pathSchema = zod.strictObject({
  /** 跳转的文件名称 */
  path: zod.string().min(1, "路径不能为空"),
});

export const urlSchema = zod.strictObject({
  /** 处理后的路径 */
  url: zod.string().min(1, "页面路径不能为空"),
});

export const officialProfileSchema = zod.strictObject({
  action: zod.literal("official"),
  /** 用户名 */
  username: zod.string(),
});

export const officialArticleSchema = zod.strictObject({
  action: zod.literal("article"),
  /** 文章链接 */
  url: zod
    .string()
    .regex(/^https:\/\/mp.weixin.qq.com\/s\//, "文章链接格式不正确"),
});

export const channelProfileSchema = zod.strictObject({
  action: zod.literal("channel"),
  /** 用户 ID */
  id: zod.string(),
});

export const channelVideoSchema = zod.strictObject({
  action: zod.literal("video"),
  /** 视频号 ID */
  username: zod.string(),
  /** 视频 ID */
  id: zod.string(),
});

const miniProgramBaseSchema = zod.strictObject({
  action: zod.literal("miniProgram"),
  /** 需要传递给目标小程序的数据 */
  extraData: zod.record(zod.string(), zod.unknown()).optional(),
  /** 要打开的小程序版本 */
  versionType: zod.enum(["develop", "trial", "release"]).optional(),
});

export const miniProgramFullSchema = zod.strictObject({
  ...miniProgramBaseSchema.shape,
  /** 要打开的小程序 appId */
  appId: zod.string().min(1, "小程序 appId 不能为空"),
  /** 打开的页面路径 */
  path: zod.string().optional(),
});

export const miniProgramShortLinkSchema = zod.strictObject({
  ...miniProgramBaseSchema.shape,
  /** 小程序短链 */
  shortLink: zod.string(),
});

export const justifySchema = zod.enum(["left", "right", "center", "justify"]);

export type Env = zod.infer<typeof envSchema>;

export type ImageMode = zod.infer<typeof imageModeSchema>;

export interface BaseComponentOptions {
  /** 显示的环境 */
  env?: Env[];
}
