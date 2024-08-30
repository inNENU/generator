import { checkKeys } from "@mr-hope/assert-type";

import type { ActionComponentOptions } from "./typings.js";
import { checkFile, getFileLink } from "../../utils.js";

export const getActionJSON = (
  action: ActionComponentOptions,
  location = "",
): ActionComponentOptions => {
  checkFile(action.content, location);

  // Convert alias here to avoid complicated logic in mini app
  action.content = getFileLink(action.content);

  checkKeys(
    action,
    {
      tag: "string",
      header: ["string", "undefined"],
      content: "string",
      env: ["string[]", "undefined"],
    },
    location,
  );

  return action;
};
