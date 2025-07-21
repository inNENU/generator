import * as zod from "zod";

import { envListSchema } from "../../schema/common.js";

export const tableSchema = zod.strictObject({
  /** 文字标签 */
  tag: zod.literal("table"),
  /** 表格标题 */
  caption: zod.string().optional(),
  /** 表头 */
  header: zod.array(zod.string()).min(1, "表头不能为空"),
  /** 表格主体 */
  body: zod.array(zod.array(zod.string())).min(1, "表格内容不能为空"),
  /** 环境列表 */
  env: envListSchema,
});

export type TableComponentOptions = zod.infer<typeof tableSchema>;

export const checkTable = (
  table: TableComponentOptions,
  location = "",
): void => {
  const result = tableSchema.safeParse(table);

  if (!result.success) {
    console.error(
      `${location} 发现非法 table 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
