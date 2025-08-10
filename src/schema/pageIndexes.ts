import * as zod from "zod";

import { iconSchema } from "./common.js";

export const pageIndexSchema = zod.strictObject({
  /** 页面名称 */
  name: zod.string().min(1, "页面名称不能为空"),
  /** 页面图标 */
  icon: iconSchema,
  /** 页面链接 */
  url: zod.string().min(1, "页面链接不能为空"),
  /** 页面标签 */
  tags: zod.array(zod.string()).optional(),
});

export type PageIndexItem = zod.infer<typeof pageIndexSchema>;

export const pageIndexesSchema = zod.array(pageIndexSchema);

export type PageIndexes = zod.infer<typeof pageIndexesSchema>;

export const checkPageIndex = (data: PageIndexes, location: string): void => {
  const result = pageIndexesSchema.safeParse(data);

  if (!result.success) {
    console.error(
      `${location} 发现非法页面索引数据:`,
      zod.prettifyError(result.error),
    );
  }
};
