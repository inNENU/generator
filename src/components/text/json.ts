import { convertStyle, resolvePagePath } from "../../utils.js";
import { omitEmptyPath } from "../utils.js";
import type { TextComponentData, TextComponentOptions } from "./schema.js";

export const getTextJSON = (
  text: TextComponentOptions,
  pageId: string,
  location = "",
): TextComponentData => {
  let resolvedPath = "";

  if ("path" in text && text.path && !("appId" in text)) {
    // @ts-expect-error: checking for invalid types
    if (text.type === "none" || !text.type)
      console.warn(`${location}: A type must be set when path is set`);

    resolvedPath = resolvePagePath(text.path, pageId);
  }

  const { style, text: textContent, ...data } = text;
  const convertedStyle = convertStyle(style);

  return {
    ...omitEmptyPath(data),
    ...(resolvedPath ? { path: resolvedPath } : {}),
    text: typeof textContent === "string" ? [textContent] : (textContent ?? []),
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
