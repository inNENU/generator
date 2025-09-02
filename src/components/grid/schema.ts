import * as zod from "zod";

import {
  channelProfileSchema,
  channelVideoSchema,
  envListSchema,
  iconSchema,
  miniProgramFullSchema,
  miniProgramShortLinkSchema,
  officialArticleSchema,
  officialProfileSchema,
  pathSchema,
  urlSchema,
} from "../../schema/common.js";
import {} from "../schema.js";

const baseGridItemSchema = zod.strictObject({
  /** 网格文字 */
  text: zod.string().min(1, "网格文字不能为空").meta({
    description: "网格文字",
  }),
  /** 网格图标的在线路径或本地路径 */
  icon: iconSchema.meta({
    description: "网格图标的在线路径或本地路径",
  }),
  /** 环境列表 */
  env: envListSchema,
});

const normalGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...pathSchema.shape,
});

const pageGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...urlSchema.shape,
});

const officialProfileGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...officialProfileSchema.shape,
});

const channelProfileGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...channelProfileSchema.shape,
});

const articleGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...officialArticleSchema.shape,
});

const videoGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...channelVideoSchema.shape,
});

const miniProgramFullGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...miniProgramFullSchema.shape,
});

const miniProgramShortLinkGridItemSchema = zod.strictObject({
  ...baseGridItemSchema.shape,
  ...miniProgramShortLinkSchema.shape,
});

const gridItemSchema = zod.union([
  normalGridItemSchema,
  pageGridItemSchema,
  officialProfileGridItemSchema,
  channelProfileGridItemSchema,
  articleGridItemSchema,
  videoGridItemSchema,
  miniProgramFullGridItemSchema,
  miniProgramShortLinkGridItemSchema,
]);

export const gridSchema = zod
  .strictObject({
    tag: zod.literal("grid"),
    /** 网格标题 */
    header: zod
      .string()
      .meta({
        description: "网格标题",
      })
      .optional(),
    /** 网格项目列表 */
    items: zod.array(gridItemSchema).min(1, "至少需要一个网格项目").meta({
      description: "网格项目列表",
    }),
    /** 网格页脚 */
    footer: zod
      .string()
      .meta({
        description: "网格页脚",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "grid-component",
    description: "网格组件",
  });

export type BaseGridComponentItemOptions = zod.infer<typeof baseGridItemSchema>;
export type NormalGridComponentItemOptions = zod.infer<
  typeof normalGridItemSchema
>;
export type PageGridComponentItemOptions = zod.infer<typeof pageGridItemSchema>;
export type MiniProgramGridComponentItemOptions = zod.infer<
  | typeof miniProgramFullGridItemSchema
  | typeof miniProgramShortLinkGridItemSchema
>;

export type GridComponentItemOptions =
  | MiniProgramGridComponentItemOptions
  | NormalGridComponentItemOptions
  | PageGridComponentItemOptions;

export type GridComponentOptions = zod.infer<typeof gridSchema>;

export const checkGrid = (grid: GridComponentOptions, location = ""): void => {
  const result = gridSchema.safeParse(grid);

  if (!result.success) {
    console.error(
      `${location} 发现非法 grid 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
