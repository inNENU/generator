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
  });

export const internalDocsSchema = zod
  .templateLiteral(["$file/", zod.string(), docExtensionSchema])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: "文件不存在",
    abort: true,
  });

export const internalFileSchema = zod
  .templateLiteral(["$file/", zod.string()])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: "文件不存在",
    abort: true,
  });

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

export type Env = zod.infer<typeof envSchema>;

export type ImageMode = zod.infer<typeof imageModeSchema>;

export interface BaseComponentOptions {
  /** 显示的环境 */
  env?: Env[];
}
