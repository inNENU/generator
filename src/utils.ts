import { existsSync } from "node:fs";
import path from "node:path";

import { join } from "upath";

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
    .replaceAll(hyphenateRE, "$<before>-$<upper>")
    .replaceAll(hyphenateRE, "$<before>-$<upper>")
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
    .join("\n");

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
 * @returns 校验问题列表
 */
export const checkFile = (link?: string, location = ""): string[] => {
  if (typeof link === "string" && link.startsWith("$")) {
    const [localPath] = link.replace(/^\$/u, "./").split("?");

    if (!existsSync(localPath)) {
      const message = `${link.startsWith("$img") ? "Image" : "File"} ${localPath} not exist${location ? ` in ${location}` : ""}.`;

      console.error(message);

      return [message];
    }
  }

  return [];
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
 * @returns 校验问题列表
 */
export const checkIcon = (icon?: string, location = ""): string[] => {
  if (icon) {
    if (icon.startsWith("$")) return checkFile(icon, location);

    if (!/^https?:\/\//u.test(icon) && !icon.includes(".")) {
      const iconPath = `./data/icon/${icon}.svg`;

      if (!existsSync(iconPath)) {
        const message = `图标 ${icon} 在 ${location} 中不存在`;

        console.error(message);

        return [message];
      }
    }
  }

  return [];
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
 * 将文件路径解析为项目内的规范路径
 *
 * @param filePath 文件路径
 * @returns 规范路径
 */
export const resolvePath = (filePath: string): string => {
  const [pathname] = filePath.split(/[?#]/u);
  const normalized = path.posix.normalize(pathname.replaceAll("\\", "/").replace(/^\/+/u, ""));
  const resolved = normalized === "." ? "" : normalized;

  if (resolved === ".." || resolved.startsWith("../"))
    throw new Error(`路径不能超出项目目录: ${filePath}`);

  if (!resolved) return "index";

  return resolved.endsWith("/") ? `${resolved}index` : resolved;
};

/**
 * 解析页面跳转路径
 *
 * @param targetPath 跳转路径
 * @param pageId 当前页面 ID
 * @returns 解析后的路径，路径为空时返回空字符串
 */
export const resolvePagePath = (targetPath: string | null | undefined, pageId: string): string => {
  if (!targetPath) return "";

  if (targetPath.startsWith("/")) return resolvePath(targetPath);

  const paths = pageId.split("/");

  paths.pop();

  return resolvePath(`${paths.join("/")}/${targetPath}`);
};

/**
 * 检查页面跳转路径是否存在
 *
 * @param targetPath 跳转路径
 * @param pageId 当前页面 ID
 * @param location 路径所在位置
 * @returns 校验问题列表
 */
export const checkPagePath = (
  targetPath: string | null | undefined,
  pageId: string,
  location = "",
): string[] => {
  const resolvedPath = resolvePagePath(targetPath, pageId);

  if (!resolvedPath) return [];

  if (!existsSync(join(generatorConfig.pageFolder, `${resolvedPath}.yml`))) {
    const message = `路径 ${resolvedPath} 在 ${location} 中不存在`;

    console.error(message);

    return [message];
  }

  return [];
};

/**
 * 获取资源图标链接
 *
 * @param name 图标名称
 * @returns 资源图标链接，使用 `config()` 中配置的 `assets` 目录，未配置时回退到 `/assets`
 */
export const getAssetIconLink = (name: string): string =>
  `${generatorConfig.assets || "/assets"}/icon/${name}.svg`;

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
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * 转义容器正文中的块级 Markdown 语法
 *
 * 提示框正文会原样嵌入 `::: type` 容器；正文行首若出现 `:::`、围栏代码或标题语法，会提前闭合容器或跳出提示框样式。
 * 逐行给这些行首加上反斜杠转义，渲染结果仍是原文字符，但不再被解析为块级语法。
 *
 * @param text 已做 HTML 转义的正文
 * @returns 转义后的正文
 */
export const escapeContainerBodySyntax = (text: string): string =>
  text
    .split("\n")
    .map((line) =>
      line
        .replace(/^(?<indent> {0,3})(?<fence>:{3,}|```|~~~)/u, String.raw`$<indent>\$<fence>`)
        .replace(/^(?<indent> {0,3})(?<heading>#{1,6})(?=\s)/u, String.raw`$<indent>\$<heading>`),
    )
    .join("\n");
