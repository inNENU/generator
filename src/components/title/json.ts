import { convertStyle } from "../../utils.js";
import type { TitleComponentData, TitleComponentOptions } from "./schema.js";

export const getTitleJSON = (title: TitleComponentOptions): TitleComponentData => {
  const { style, ...rest } = title;
  const convertedStyle = convertStyle(style);

  return {
    ...rest,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
