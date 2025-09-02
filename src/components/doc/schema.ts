import * as zod from "zod";

import { envListSchema, fileSchema } from "../../schema/common.js";

export const docSchema = zod
  .strictObject({
    tag: zod.literal("doc"),
    /** 文档名称 */
    name: zod.string().min(1, "文档名称不能为空").meta({
      description: "文档名称",
    }),
    /** 文档地址 */
    url: fileSchema.meta({
      description: "文档地址",
    }),
    /**
     * 文档是否可下载
     *
     * @default true
     */
    downloadable: zod
      .literal(false)
      .meta({
        description: "文档是否可下载",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "doc-component",
    description: "文档组件",
  });

export type DocComponentOptions = zod.infer<typeof docSchema>;

export interface DocComponentData extends DocComponentOptions {
  /** 文档图标 */
  icon: string;
  /** 处理后的文档地址 */
  url: string;
}

export const checkDoc = (doc: DocComponentOptions, location = ""): void => {
  const result = docSchema.safeParse(doc);

  if (!result.success) {
    console.error(
      `${location} 发现非法 doc 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
