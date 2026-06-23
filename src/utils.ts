import { existsSync } from "node:fs";
import path from "node:path";

import { generatorConfig } from "./config.js";

export const camelCase2kebabCase = (str: string): string => {
  const hyphenateRE = /(?<before>[^-])(?<upper>[A-Z])/gu;

  return str
    .replace(hyphenateRE, "$<before>-$<upper>")
    .replace(hyphenateRE, "$<before>-$<upper>")
    .toLowerCase();
};

export const indentMarkdownListItem = (content: string, indent = 0): string =>
  content
    .split("\n")
    .map((line, index) =>
      index === 0 ? line : `${Array.from({ length: indent }, () => " ").join("")}${line}`,
    )
    .join("\n\n");

export const getMarkdownPath = (filePath: string): string =>
  `${filePath.replace(/\/(?:index)?$/u, "/README")}.md`;

export const getHTMLPath = (filePath: string): string =>
  filePath.endsWith("/")
    ? filePath
    : filePath.endsWith("/index")
      ? filePath.slice(0, -5)
      : `${filePath}.html`;

export const checkFile = (link?: string, location = ""): void => {
  if (typeof link === "string" && link.startsWith("$")) {
    const [localPath] = link.replace(/^\$/u, "./").split("?");

    if (!existsSync(localPath)) {
      console.error(
        `${link.startsWith("$img") ? "Image" : "File"} ${localPath} not exist${location ? ` in ${location}` : ""}.`,
      );
    }
  }
};

export const getFileLink = (link?: string): string | null => {
  if (typeof link !== "string") return null;

  if (link.startsWith("$")) return link.replace(/^\$/u, `${generatorConfig.assets}/`);

  return link;
};

export const checkIcon = (icon?: string, location = ""): void => {
  if (icon) {
    if (icon.startsWith("$")) {
      checkFile(icon, location);
    } else if (!/^https?:\/\//u.test(icon) && !icon.includes(".")) {
      const iconPath = `./data/icon/${icon}.svg`;

      if (!existsSync(iconPath)) console.error(`图标 ${icon} 在 ${location} 中不存在`);
    }
  }
};

export const getIconLink = (icon?: string): string | null => {
  if (!icon) return null;

  if (icon.startsWith("$")) return getFileLink(icon);

  if (!/^https?:\/\//u.test(icon) && !icon.includes("."))
    return `${generatorConfig.icon}/${icon}.svg`;

  return icon;
};

export const resolvePath = (filePath: string): string =>
  path
    .relative(
      process.cwd(),
      path.resolve(filePath.replace(/\/\//u, "/").replace(/^\//u, "").replace(/\/$/u, "/index")),
    )
    .replaceAll(path.sep, "/");

export const getAssetIconLink = (name: string): string => `/assets/icon/${name}.svg`;

export const convertStyle = (style?: string | Record<string, string>): string | null => {
  if (!style) return null;

  if (typeof style === "string") return style;

  let result = "";

  Object.entries(style).forEach(([key, value]) => {
    result += `${camelCase2kebabCase(key)}:${value};`;
  });

  return result;
};
