import type { TitleComponentData, TitleComponentOptions } from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getTitleJSON = (
  title: TitleComponentOptions,
): TitleComponentData => {
  const { style, ...rest } = title;
  const convertedStyle = convertStyle(style);

  return {
    ...rest,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
