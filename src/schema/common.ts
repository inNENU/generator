import { existsSync } from "node:fs";

import * as zod from "zod";

zod.config(zod.locales.zhCN());

export const envSchema = zod.enum(["web", "wx", "app"]);
export type Env = zod.infer<typeof envSchema>;
export const envListSchema = zod.array(envSchema).optional().meta({
  description: "环境列表",
});

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
export type ImageMode = zod.infer<typeof imageModeSchema>;

export const imageExtensionSchema = zod.enum(
  [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp", ".ico"],
  {
    error: ({ input }) => `输入 ${String(input)}不满足指定图片后缀`,
  },
);

export const docExtensionSchema = zod.enum(
  [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
  {
    error: ({ input }) => `输入 ${String(input)}不满足指定文档后缀`,
  },
);

export const internalImgSchema = zod
  .templateLiteral(["$img/", zod.string(), imageExtensionSchema])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: ({ input }) => `图片 ${String(input)} 不存在`,
    abort: true,
  }) as unknown as zod.ZodString;

export const internalDocsSchema = zod
  .templateLiteral(["$file/", zod.string(), docExtensionSchema])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: ({ input }) => `文档 ${String(input)} 不存在`,
    abort: true,
  }) as unknown as zod.ZodString;

export const internalFileSchema = zod
  .templateLiteral(["$file/", zod.string()])
  .refine((link) => existsSync("./" + link.substring(1)), {
    error: ({ input }) => `文件 ${String(input)} 不存在`,
    abort: true,
  }) as unknown as zod.ZodString;

export const httpsLinkSchema = zod.url({ protocol: /^https$/ });

export const imgSchema = zod
  .union([httpsLinkSchema, internalImgSchema], {
    error: ({ input }) => `图片 ${String(input)} 不满足指定格式`,
  })
  .meta({
    description: "图片地址",
  });
export const fileSchema = zod
  .union([httpsLinkSchema, internalFileSchema], {
    error: ({ input }) => `文件 ${String(input)} 不满足指定格式`,
  })
  .meta({
    description: "文件地址",
  });

export const internalIconSchema = zod
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    error: ({ input }) =>
      `图标 ${String(input)} 只能包含小写字母、数字和连字符`,
  })
  .refine((icon) => existsSync(`./data/icon/${icon}.svg`), {
    error: ({ input }) => `图标文件 ${String(input)} 不存在`,
    abort: true,
  });

export const iconSchema = zod.union([internalIconSchema, imgSchema]).meta({
  description: "图标",
});

export const locSchema = zod
  .templateLiteral(
    [
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
    ],
    {
      error: ({ input }) => `位置 ${String(input)} 不满足指定格式`,
    },
  )
  .meta({
    description: "位置坐标",
  });
export type Loc = zod.infer<typeof locSchema>;

export const styleSchema = zod
  .union([zod.string(), zod.record(zod.string(), zod.string())])
  .optional();

export const pathSchema = zod.strictObject({
  /** 跳转的文件名称 */
  path: zod.string().min(1, "路径不能为空"),
});
export type PathOptions = zod.infer<typeof pathSchema>;

export const urlSchema = zod.strictObject({
  /** 处理后的路径 */
  url: zod.string().min(1, "页面路径不能为空"),
});
export type UrlOptions = zod.infer<typeof urlSchema>;

export const officialProfileSchema = zod.strictObject({
  action: zod.literal("official"),
  /** 用户名 */
  username: zod.string(),
});
export type OfficialProfileOptions = zod.infer<typeof officialProfileSchema>;

export const officialArticleSchema = zod.strictObject({
  action: zod.literal("article"),
  /** 文章链接 */
  url: zod.string().regex(/^https:\/\/mp.weixin.qq.com\/s\//, {
    error: ({ input }) => `文章链接 ${String(input)} 格式不正确`,
  }),
});
export type OfficialArticleOptions = zod.infer<typeof officialArticleSchema>;

export const channelProfileSchema = zod.strictObject({
  action: zod.literal("channel"),
  /** 视频号名称 */
  username: zod.string(),
  /** 视频号 ID */
  id: zod.string(),
});
export type ChannelProfileOptions = zod.infer<typeof channelProfileSchema>;

export const channelVideoSchema = zod.strictObject({
  action: zod.literal("video"),
  /** 视频号 ID */
  username: zod.string(),
  /** 视频 ID */
  id: zod.string(),
});
export type ChannelVideoOptions = zod.infer<typeof channelVideoSchema>;

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
export type MiniProgramFullOptions = zod.infer<typeof miniProgramFullSchema>;

export const miniProgramShortLinkSchema = zod.strictObject({
  ...miniProgramBaseSchema.shape,
  /** 小程序短链 */
  shortLink: zod.string(),
});
export type MiniProgramShortLinkOptions = zod.infer<
  typeof miniProgramShortLinkSchema
>;

export const justifySchema = zod.enum(["left", "right", "center", "justify"], {
  error: ({ input }) =>
    `对齐方式 ${String(input)} 不满足 "left" | "right" | "center" | "justify"`,
});
export type Justify = zod.infer<typeof justifySchema>;
