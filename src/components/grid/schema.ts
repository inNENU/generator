import * as zod from "zod/v4";

import { envListSchema, iconSchema } from "../common.js";

const baseGridItemSchema = zod.object({
  /** 网格文字 */
  text: zod.string().min(1, "网格文字不能为空"),
  /** 网格图标的在线路径或本地路径 */
  icon: iconSchema,
  /** 环境列表 */
  env: envListSchema,
});

const normalGridItemSchema = baseGridItemSchema.extend({
  /** 对应页面的文件路径 */
  path: zod.string().min(1, "页面路径不能为空"),
});

const pageGridItemSchema = baseGridItemSchema.extend({
  /** 小程序页面路径 */
  url: zod.string(),
});

const miniProgramGridItemSchema = baseGridItemSchema.extend({
  /** 要打开的小程序 appId */
  appId: zod.string().min(1, "小程序 appId 不能为空"),
  /** 打开的页面路径 */
  path: zod.string().optional(),
  /** 需要传递给目标小程序的数据 */
  extraData: zod.record(zod.string(), zod.unknown()).optional(),
  /** 要打开的小程序版本 */
  versionType: zod.enum(["develop", "trial", "release"]).optional(),
});

const gridItemSchema = zod.union([
  normalGridItemSchema,
  pageGridItemSchema,
  miniProgramGridItemSchema,
]);

export const gridSchema = zod.strictObject({
  tag: zod.literal("grid"),
  /** 网格标题 */
  header: zod.union([zod.string(), zod.literal(false)]).optional(),
  /** 网格项目列表 */
  items: zod.array(gridItemSchema).min(1, "至少需要一个网格项目"),
  /** 网格页脚 */
  footer: zod.string().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type BaseGridComponentItemOptions = zod.infer<typeof baseGridItemSchema>;
export type NormalGridComponentItemOptions = zod.infer<
  typeof normalGridItemSchema
>;
export type PageGridComponentItemOptions = zod.infer<typeof pageGridItemSchema>;
export type MiniProgramGridComponentItemOptions = zod.infer<
  typeof miniProgramGridItemSchema
>;

export type GridComponentItemOptions =
  | MiniProgramGridComponentItemOptions
  | NormalGridComponentItemOptions
  | PageGridComponentItemOptions;

export type GridComponentOptions = zod.infer<typeof gridSchema>;

export const checkGrid = (grid: GridComponentOptions, location = ""): void => {
  try {
    gridSchema.parse(grid);
  } catch (error) {
    console.error(`Invalid grid data at ${location}:`, error);
  }
};
