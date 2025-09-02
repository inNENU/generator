import * as zod from "zod";

import { iconSchema } from "./common.js";

export const pageIndexSchema = zod
  .strictObject({
    /** 页面名称 */
    name: zod.string().min(1, "页面名称不能为空").meta({
      description: "页面名称",
    }),
    /** 页面图标 */
    icon: iconSchema.meta({
      description: "页面图标",
    }),
    /** 页面链接 */
    url: zod.string().min(1, "页面链接不能为空").meta({
      description: "页面链接",
    }),
    /** 页面标签 */
    tags: zod
      .array(zod.string())
      .meta({
        description: "页面标签",
      })
      .optional(),
  })
  .meta({
    id: "page-index",
    description: "页面索引项",
  });

export type PageIndexItem = zod.infer<typeof pageIndexSchema>;

export const pageIndexesSchema = zod.array(pageIndexSchema).meta({
  id: "page-indexes",
  description: "页面索引列表",
});

export type PageIndexes = zod.infer<typeof pageIndexesSchema>;

export const checkPageIndexes = (data: PageIndexes, location: string): void => {
  const result = pageIndexesSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法页面索引数据:`,
      zod.prettifyError(result.error),
    );
  }
};
