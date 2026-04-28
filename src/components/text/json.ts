import { existsSync } from "node:fs";

import { convertStyle, resolvePath } from "../../utils.js";
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

    let path: string;

    if (text.path.startsWith("/")) {
      path = resolvePath(text.path);
    } else {
      const paths = pageId.split("/");

      paths.pop();

      path = resolvePath(`${paths.join("/")}/${text.path}`);
    }

    if (!existsSync(`./pages/${path}.yml`)) console.error(`路径 ${path} 在 ${location} 中不存在`);
    text.path = path;
  }

  const { style, text: textContent, ...data } = text;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    text: typeof textContent === "string" ? [textContent] : (textContent ?? []),
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
