import * as zod from "zod";

import { useCompiled } from "../../helpers/compile.js";
import { collectZodIssues } from "../../helpers/validation.js";
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
      .array(zod.url({ protocol: /^https?$/u }))
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

export const checkFooter = (footer: FooterComponentOptions, location = ""): string[] => {
  const result = useCompiled(footerSchema).safeParse(footer);

  return result.success ? [] : collectZodIssues(location, "发现非法 footer 数据", result.error);
};
