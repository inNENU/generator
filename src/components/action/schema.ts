import * as zod from "zod";

import { useCompiled } from "../../helpers/compile.js";
import { collectZodIssues } from "../../helpers/validation.js";
import { envListSchema } from "../../schema/common.js";

export const actionSchema = zod
  .strictObject({
    tag: zod.literal("action"),
    /** 标题 */
    header: zod
      .string()
      .meta({
        description: "标题",
      })
      .optional(),
    /** 动作内容 */
    content: zod.string().min(1, "动作内容不能为空").meta({
      description: "动作内容",
    }),
    /** 环境列表 */
    env: envListSchema,
  })
  .meta({
    id: "action-component",
    description: "动作组件",
  });

export type ActionComponentOptions = zod.infer<typeof actionSchema>;

export const checkAction = (action: ActionComponentOptions, location = ""): string[] => {
  const result = useCompiled(actionSchema).safeParse(action);

  return result.success ? [] : collectZodIssues(location, "发现非法 action 数据", result.error);
};
