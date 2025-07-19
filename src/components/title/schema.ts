import * as zod from "zod";

import { envListSchema, styleSchema } from "../../schema/common.js";

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

export interface TitleComponentData
  extends Omit<TitleComponentOptions, "style"> {
  /** 处理后的样式 */
  style?: string;
}

export const checkTitle = (
  title: TitleComponentOptions,
  location = "",
): void => {
  try {
    titleSchema.parse(title);
  } catch (error) {
    console.error(`${location} 发现非法 title 数据:`, error);
  }
};
