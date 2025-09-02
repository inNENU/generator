import * as zod from "zod";

import { envListSchema, locSchema } from "../../schema/common.js";

const pointSchema = zod.strictObject({
  /** 位置信息 */
  loc: locSchema.meta({
    description: "位置信息",
  }),
  /** 地点名称 */
  name: zod
    .string()
    .meta({
      description: "地点名称",
    })
    .optional(),
  /** 地点详情 */
  detail: zod
    .string()
    .meta({
      description: "地点详情",
    })
    .optional(),
  /** 地图模块中的路径 */
  path: zod
    .string()
    .meta({
      description: "地图模块中的路径",
    })
    .optional(),
});

export const locationSchema = zod
  .strictObject({
    tag: zod.literal("location"),
    /** 地点标题 */
    header: zod.string().min(1, "地点标题不能为空").meta({
      description: "地点标题",
    }),
    /** 位置点信息 */
    points: zod.array(pointSchema).min(1, "至少需要一个位置点").meta({
      description: "位置点信息",
    }),
    /**
     * 是否可以导航
     *
     * @default true
     */
    navigate: zod
      .boolean()
      .meta({
        description: "是否可以导航",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "location-component",
    description: "位置组件",
  });

export type LocationConfig = zod.infer<typeof pointSchema>;
export type LocationComponentOptions = zod.infer<typeof locationSchema>;

export const checkLocation = (
  location: LocationComponentOptions,
  locationStr = "",
): void => {
  const result = locationSchema.safeParse(location);

  if (!result.success) {
    console.error(
      `非法 location 数据在 ${locationStr}:`,
      zod.prettifyError(result.error),
    );
  }
};
