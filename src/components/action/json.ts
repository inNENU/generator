import type { ActionComponentOptions } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getActionJSON = (
  action: ActionComponentOptions,
): ActionComponentOptions => {
  // Convert alias here to avoid complicated logic in mini app
  const processedContent = getFileLink(action.content);

  if (processedContent !== null) {
    action.content = processedContent;
  }

  return action;
};
