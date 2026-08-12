import { convertStyle, resolvePagePath } from "../../utils.js";
import type { TextComponentData, TextComponentOptions } from "./schema.js";

export const getTextJSON = (
  text: TextComponentOptions,
  pageId: string,
  location = "",
): TextComponentData => {
  if ("path" in text && text.path && !("appId" in text)) {
    // @ts-expect-error: checking for invalid types
    if (text.type === "none" || !text.type)
      console.warn(`${location}: A type must be set when path is set`);

    text.path = resolvePagePath(text.path, pageId);
  }

  const { style, text: textContent, ...data } = text;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    text: typeof textContent === "string" ? [textContent] : (textContent ?? []),
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
