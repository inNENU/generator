import * as zod from "zod/v4";

import { envListSchema, fileSchema } from "../../schema/common.js";

export const docSchema = zod.strictObject({
  tag: zod.literal("doc"),
  /** 文档名称 */
  name: zod.string().min(1, "文档名称不能为空"),
  /** 文档地址 */
  url: fileSchema,
  /**
   * 文档是否可下载
   *
   * @default true
   */
  downloadable: zod.literal(false).optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type DocComponentOptions = zod.infer<typeof docSchema>;

export interface DocComponentData extends DocComponentOptions {
  /** 文档图标 */
  icon: string;
  /** 处理后的文档地址 */
  url: string;
}

export const checkDoc = (doc: DocComponentOptions, location = ""): void => {
  try {
    docSchema.parse(doc);
  } catch (error) {
    console.error(`${location} 发现非法 doc 数据:`, error);
  }
};
