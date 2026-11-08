import * as zod from "zod";

import { useCompiled } from "../../helpers/compile.js";
import { collectZodIssues } from "../../helpers/validation.js";
import { envListSchema } from "../../schema/common.js";

export const tableSchema = zod
  .strictObject({
    /** 文字标签 */
    tag: zod.literal("table"),
    /** 表格标题 */
    caption: zod
      .string()
      .meta({
        description: "表格标题",
      })
      .optional(),
    /** 表头 */
    header: zod.array(zod.string()).min(1, "表头不能为空").meta({
      description: "表头",
    }),
    /** 表格主体 */
    body: zod.array(zod.array(zod.string())).min(1, "表格内容不能为空").meta({
      description: "表格主体",
    }),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "table-component",
    description: "表格组件",
  });

export type TableComponentOptions = zod.infer<typeof tableSchema>;

/**
 * 检查表格数据
 *
 * @param table 表格数据
 * @param location 表格所在位置
 * @returns 校验问题列表
 */
export const checkTable = (table: TableComponentOptions, location = ""): string[] => {
  const result = useCompiled(tableSchema).safeParse(table);
  const issues = result.success
    ? []
    : collectZodIssues(location, "发现非法 table 数据", result.error);

  if (result.success) {
    const columnCount = table.header.length;

    table.body.forEach((row, index) => {
      if (row.length !== columnCount) {
        issues.push(
          `${location} 表格第 ${index + 1} 行列数不一致：期望 ${columnCount} 列，实际 ${row.length} 列`,
        );
      }
    });
  }

  return issues;
};
