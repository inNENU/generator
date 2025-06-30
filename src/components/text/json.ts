import { existsSync } from "node:fs";

import type { TextComponentData, TextComponentOptions } from "./schema.js";
import { checkText } from "./schema.js";
import { convertStyle, resolvePath } from "../../utils.js";

export const getTextJSON = (
  text: TextComponentOptions,
  pageId: string,
  location = "",
): TextComponentData => {
  checkText(text, location);

  if ("path" in text && text.path && !("appId" in text)) {
    // @ts-expect-error: checking for invalid types
    if (text.type === "none" || !text.type)
      console.warn(`${location}: A type must be set when path is set`);

    if (text.path.startsWith("/")) {
      const path = resolvePath(text.path);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`路径 ${path} 在 ${location} 中不存在`);

      text.path = path;
    } else {
      const paths = pageId.split("/");

      paths.pop();

      const path = resolvePath(`${paths.join("/")}/${text.path}`);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`路径 ${path} 在 ${location} 中不存在`);

      text.path = path;
    }
  }

  const { style, text: textContent, ...data } = text;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    text: typeof textContent === "string" ? [textContent] : (textContent ?? []),
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
