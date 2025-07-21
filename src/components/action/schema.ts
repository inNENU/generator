import * as zod from "zod";

import { envListSchema } from "../../schema/common.js";

export const actionSchema = zod.strictObject({
  tag: zod.literal("action"),
  /** 标题 */
  header: zod.string().optional(),
  /** 动作内容 */
  content: zod.string().min(1, "动作内容不能为空"),
  /** 环境列表 */
  env: envListSchema,
});

export type ActionComponentOptions = zod.infer<typeof actionSchema>;

export const checkAction = (
  action: ActionComponentOptions,
  location = "",
): void => {
  const result = actionSchema.safeParse(action);

  if (!result.success) {
    console.error(
      `${location} 发现非法 action 数据:`,
      zod.prettifyError(result.error),
    );
  }
};
