import * as zod from "zod/v4";

import { envListSchema } from "../common.js";

export const footerSchema = zod.strictObject({
  tag: zod.literal("footer"),
  /** 作者 */
  author: zod.string().optional(),
  /** 最后更新日期 */
  time: zod.string().optional(),
  /** 额外描述 */
  desc: zod.string().optional(),
  /** 原文链接 */
  cite: zod.array(zod.url({ protocol: /^https?$/ })).optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type FooterComponentOptions = zod.infer<typeof footerSchema>;

export const checkFooter = (
  footer: FooterComponentOptions,
  location = "",
): void => {
  try {
    footerSchema.parse(footer);
  } catch (error) {
    console.error(`Invalid footer data at ${location}:`, error);
  }
};
