import type { TitleComponentData, TitleComponentOptions } from "./schema.js";
import { checkTitle } from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getTitleJSON = (
  title: TitleComponentOptions,
  location = "",
): TitleComponentData => {
  checkTitle(title, location);

  const { style, ...rest } = title;
  const convertedStyle = convertStyle(style);

  return {
    ...rest,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
