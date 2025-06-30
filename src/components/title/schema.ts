import * as zod from "zod/v4";

import { envListSchema, styleSchema } from "../common.js";

export const titleSchema = zod.strictObject({
  tag: zod.literal("title"),
  /** 标题文字 */
  text: zod.string().min(1, "标题文字不能为空"),
  /** 标题 css 样式 */
  style: styleSchema.optional(),
  /** 环境列表 */
  env: envListSchema,
});

export type TitleComponentOptions = zod.infer<typeof titleSchema>;

export const checkTitle = (
  title: TitleComponentOptions,
  location = "",
): void => {
  try {
    titleSchema.parse(title);
  } catch (error) {
    console.error(`Invalid title data at ${location}:`, error);
  }
};
