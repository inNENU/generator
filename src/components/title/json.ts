import { checkKeys } from "@mr-hope/assert-type";

import type { TitleComponentOptions } from "./typings.js";
import { resolveStyle } from "../../utils.js";

export const getTitleJSON = (
  title: TitleComponentOptions,
  location = "",
): TitleComponentOptions => {
  // 处理样式
  if (typeof title.style === "object") title.style = resolveStyle(title.style);

  checkKeys(
    title,
    {
      tag: "string",
      text: "string",
      style: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return title;
};
