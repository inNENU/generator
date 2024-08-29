import { checkKeys } from "@mr-hope/assert-type";

import type { ActionComponentOptions } from "./typings.js";
import { checkFile } from "../../utils.js";

export const getActionJSON = (
  action: ActionComponentOptions,
  location = "",
): ActionComponentOptions => {
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
  checkFile(action.content, location);

  return action;
};
