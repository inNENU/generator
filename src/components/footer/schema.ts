import * as zod from "zod";

import { envListSchema } from "../../schema/common.js";

export const footerSchema = zod
  .strictObject({
    tag: zod.literal("footer"),
    /** 作者 */
    author: zod
      .string()
      .meta({
        description: "作者",
      })
      .optional(),
    /** 最后更新日期 */
    time: zod
      .string()
      .meta({
        description: "最后更新日期",
      })
      .optional(),
    /** 额外描述 */
    desc: zod
      .string()
      .meta({
        description: "额外描述",
      })
      .optional(),
    /** 原文链接 */
    cite: zod
      .array(zod.url({ protocol: /^https?$/ }))
      .meta({
        description: "原文链接",
      })
      .optional(),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "footer-component",
    description: "页脚组件",
  });

export type FooterComponentOptions = zod.infer<typeof footerSchema>;

export const checkFooter = (
  footer: FooterComponentOptions,
  location = "",
): void => {
  const result = footerSchema.safeParse(footer);

  if (!result.success) {
    console.error(
      `${location} 发现非法 footer 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
