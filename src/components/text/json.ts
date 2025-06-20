import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";

import type { TextComponentOptions } from "./typings.js";
import { resolvePath, resolveStyle } from "../../utils.js";

export const getTextJSON = (
  text: TextComponentOptions,
  pageId: string,
  location = "",
): TextComponentOptions => {
  // 处理样式
  if (typeof text.style === "object") text.style = resolveStyle(text.style);

  // 处理段落
  if (typeof text.text === "string") text.text = [text.text];

  if ("path" in text && !("appId" in text)) {
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

  checkKeys(
    text,
    {
      tag: "string",
      header: ["string", "boolean", "undefined"],
      type: {
        type: ["string", "undefined"],
        enum: ["info", "tip", "warning", "danger", "note", "none"],
      },
      text: ["string[]", "undefined"],
      style: ["string", "undefined"],
      align: {
        type: ["string", "undefined"],
        enum: ["left", "right", "center", "justify"],
      },
      path: ["string", "undefined"],
      url: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return text;
};
