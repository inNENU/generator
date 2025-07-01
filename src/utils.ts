import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { _config } from "./config.js";

export const camelCase2kebabCase = (str: string): string => {
  const hyphenateRE = /([^-])([A-Z])/gu;

  return str
    .replace(hyphenateRE, "$1-$2")
    .replace(hyphenateRE, "$1-$2")
    .toLowerCase();
};

export const indentMarkdownListItem = (content: string, indent = 0): string =>
  content
    .split("\n")
    .map((line, index) =>
      index === 0 ? line : `${new Array(indent).fill(" ").join("")}${line}`,
    )
    .join("\n\n");

export const getMarkdownPath = (path: string): string =>
  `${path.replace(/\/(?:index)?$/, "/README")}.md`;

export const getHTMLPath = (path: string): string =>
  path.endsWith("/")
    ? path
    : path.endsWith("/index")
      ? path.substring(0, path.length - 5)
      : `${path}.html`;

export const checkFile = (link?: string, location = ""): void => {
  if (typeof link === "string" && link.startsWith("$")) {
    const localPath = link.replace(/^\$/, "./").split("?")[0];

    if (!existsSync(localPath))
      console.error(
        `${link.startsWith("$img") ? "Image" : "File"} ${localPath} not exist${location ? ` in ${location}` : ""}.`,
      );
  }
};

export const getFileLink = (link?: string): string | null => {
  if (typeof link !== "string") return null;

  if (link.startsWith("$")) {
    return link.replace(/^\$/, `${_config.assets}/`);
  }

  return link;
};

export const checkIcon = (icon?: string, location = ""): void => {
  if (icon) {
    if (icon.startsWith("$")) checkFile(icon, location);
    else if (!/^https?:\/\//.test(icon) && !icon.includes(".")) {
      const iconPath = `./data/icon/${icon}.svg`;

      if (!existsSync(iconPath))
        console.error(`图标 ${icon} 在 ${location} 中不存在`);
    }
  }
};

export const getIconLink = (icon?: string): string | null => {
  if (!icon) return null;

  if (icon.startsWith("$")) return getFileLink(icon);

  if (!/^https?:\/\//.test(icon) && !icon.includes(".")) {
    return `${_config.icon}/${icon}.svg`;
  }

  return icon;
};

export const resolvePath = (path: string): string =>
  relative(
    process.cwd(),
    resolve(
      path.replace(/\/\//u, "/").replace(/^\//u, "").replace(/\/$/u, "/index"),
    ),
  ).replaceAll(sep, "/");

export const getAssetIconLink = (name: string): string =>
  `/assets/icon/${name}.svg`;

export const convertStyle = (
  style?: string | Record<string, string>,
): string | null => {
  if (!style) return null;

  if (typeof style === "string") return style;

  let result = "";

  for (const key in style)
    result += `${camelCase2kebabCase(key)}:${style[key]};`;

  return result;
};
