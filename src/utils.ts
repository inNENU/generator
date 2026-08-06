import { existsSync } from "node:fs";
import path from "node:path";

import { generatorConfig } from "./config.js";

/**
 * 将驼峰命名字符串转换为 kebab-case
 *
 * @param str 驼峰命名的字符串
 * @returns Kebab-case 命名的字符串
 */
export const camelCase2kebabCase = (str: string): string => {
  const hyphenateRE = /(?<before>[^-])(?<upper>[A-Z])/gu;

  return str
    .replace(hyphenateRE, "$<before>-$<upper>")
    .replace(hyphenateRE, "$<before>-$<upper>")
    .toLowerCase();
};

/**
 * 缩进 Markdown 列表项
 *
 * @param content 需要缩进的内容
 * @param indent 缩进空格数，默认为 0
 * @returns 缩进后的内容
 */
export const indentMarkdownListItem = (content: string, indent = 0): string =>
  content
    .split("\n")
    .map((line, index) =>
      index === 0 ? line : `${Array.from({ length: indent }, () => " ").join("")}${line}`,
    )
    .join("\n\n");

/**
 * 获取文件路径对应的 Markdown 路径
 *
 * @param filePath 文件路径
 * @returns Markdown 路径
 */
export const getMarkdownPath = (filePath: string): string =>
  `${filePath.replace(/\/(?:index)?$/u, "/README")}.md`;

/**
 * 获取文件路径对应的 HTML 路径
 *
 * @param filePath 文件路径
 * @returns HTML 路径
 */
export const getHTMLPath = (filePath: string): string =>
  filePath.endsWith("/")
    ? filePath
    : filePath.endsWith("/index")
      ? filePath.slice(0, -5)
      : `${filePath}.html`;

/**
 * 检查文件是否存在
 *
 * @param link 文件链接
 * @param location 文件所在位置
 */
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

/**
 * 获取文件链接
 *
 * @param link 文件链接
 * @returns 处理后的文件链接，无效时返回 null
 */
export const getFileLink = (link?: string): string | null => {
  if (typeof link !== "string") return null;

  if (link.startsWith("$")) return link.replace(/^\$/u, `${generatorConfig.assets}/`);

  return link;
};

/**
 * 检查图标是否存在
 *
 * @param icon 图标
 * @param location 图标所在位置
 */
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

/**
 * 获取图标链接
 *
 * @param icon 图标
 * @returns 处理后的图标链接，无效时返回 null
 */
export const getIconLink = (icon?: string): string | null => {
  if (!icon) return null;

  if (icon.startsWith("$")) return getFileLink(icon);

  if (!/^https?:\/\//u.test(icon) && !icon.includes("."))
    return `${generatorConfig.icon}/${icon}.svg`;

  return icon;
};

/**
 * 将文件路径解析为相对于当前工作目录的路径
 *
 * @param filePath 文件路径
 * @returns 相对路径
 */
export const resolvePath = (filePath: string): string =>
  path
    .relative(
      process.cwd(),
      path.resolve(filePath.replace(/\/\//u, "/").replace(/^\//u, "").replace(/\/$/u, "/index")),
    )
    .replaceAll(path.sep, "/");

/**
 * 获取资源图标链接
 *
 * @param name 图标名称
 * @returns 资源图标链接
 */
export const getAssetIconLink = (name: string): string => `/assets/icon/${name}.svg`;

/**
 * 转换样式
 *
 * @param style 样式
 * @returns 转换后的样式字符串，无效时返回 null
 */
export const convertStyle = (style?: string | Record<string, string>): string | null => {
  if (!style) return null;

  if (typeof style === "string") return style;

  let result = "";

  Object.entries(style).forEach(([key, value]) => {
    result += `${camelCase2kebabCase(key)}:${value};`;
  });

  return result;
};

/**
 * 转义 HTML 特殊字符
 *
 * @param content 需要转义的内容
 * @returns 转义后的内容
 */
export const escapeHtml = (content: string): string =>
  content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
