import type { ActionComponentOptions } from "./schema.js";
import { checkAction } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getActionJSON = (
  action: ActionComponentOptions,
  location = "",
): ActionComponentOptions => {
  checkAction(action, location);

  // Convert alias here to avoid complicated logic in mini app
  const processedContent = getFileLink(action.content);

  if (processedContent !== null) {
    action.content = processedContent;
  }

  return action;
};
