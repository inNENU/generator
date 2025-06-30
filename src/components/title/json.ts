import type { TitleComponentOptions } from "./schema.js";
import { checkTitle } from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getTitleJSON = (
  title: TitleComponentOptions,
  location = "",
): TitleComponentOptions => {
  checkTitle(title, location);

  const { style, ...rest } = title;
  const convertedStyle = convertStyle(style);

  // 1. 首先执行 schema 验证

  return {
    ...rest,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
