import { getFileLink } from "../../utils.js";
import type { ActionComponentOptions } from "./schema.js";

export const getActionJSON = (action: ActionComponentOptions): ActionComponentOptions => {
  // 在此处转换别名，避免在小程序中处理复杂逻辑
  const processedContent = getFileLink(action.content);

  if (processedContent != null) action.content = processedContent;

  return action;
};
