import * as zod from "zod/v4";

import { envListSchema, locSchema } from "../../schema/common.js";

const pointSchema = zod.strictObject({
  /** 位置信息 */
  loc: locSchema,
  /** 地点名称 */
  name: zod.string().optional(),
  /** 地点详情 */
  detail: zod.string().optional(),
  /** 地图模块中的路径 */
  path: zod.string().optional(),
});

export const locationSchema = zod.strictObject({
  tag: zod.literal("location"),
  /** 地点标题 */
  header: zod.string().min(1, "地点标题不能为空"),
  /** 位置点信息 */
  points: zod.array(pointSchema).min(1, "至少需要一个位置点"),
  /**
   * 是否可以导航
   *
   * @default true
   */
  navigate: zod.boolean().optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type LocationConfig = zod.infer<typeof pointSchema>;
export type LocationComponentOptions = zod.infer<typeof locationSchema>;

export const checkLocation = (
  location: LocationComponentOptions,
  locationStr = "",
): void => {
  try {
    locationSchema.parse(location);
  } catch (error) {
    console.error(`非法 location 数据在 ${locationStr}:`, error);
  }
};
