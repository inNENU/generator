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

/** Markdown 链接文字中需要转义的字符 */
const markdownLabelEscapePattern = /[\\[\]]/gu;

/**
 * 转义 Markdown 链接文字
 *
 * 链接文字中的 `[` / `]` 会提前结束链接，`\` 会被当作 CommonMark 转义前缀。 调用前应先用 `escapeHtml` 处理 HTML 特殊字符。
 *
 * @param label 链接文字
 * @returns 可安全放入 `[]` 的链接文字
 */
export const escapeMarkdownLinkLabel = (label: string): string =>
  label.replaceAll(markdownLabelEscapePattern, (char) => `\\${char}`);

/** 链接目标中必须编码的字符：控制字符会让链接跨行，反斜杠会被当作 CommonMark 转义前缀 */
const markdownDestinationEscapePattern = /[\p{Cc}\\]/gu;

/** Markdown 会解码裸目标中的 HTML 字符引用，这些 `&` 需要固定 */
const markdownEntityAmpersandPattern = /&(?=(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/giu;

/**
 * 判断 Markdown 链接目标是否需要尖括号包裹
 *
 * 空白与尖括号会提前结束裸目标；括号必须成对，否则链接会在第一个多余的 `)` 处截断。 成对括号符合 CommonMark 语法，保持裸目标可避免改变既有产物。
 *
 * @param destination 已编码特殊字符的目标
 * @returns 是否需要尖括号包裹
 */
const needsAngleBracketDestination = (destination: string): boolean => {
  if (/[\s<>]/u.test(destination)) return true;

  let depth = 0;

  for (const char of destination) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      if (depth === 0) return true;

      depth -= 1;
    }
  }

  return depth !== 0;
};

/**
 * 格式化 Markdown 链接 / 图片目标
 *
 * 控制字符与反斜杠先做百分号编码，避免链接跨行或被当作转义；普通地址保持原样， 仅在出现空白、尖括号或不成对括号时用尖括号包裹，保证既有产物字节不变。
 *
 * 调用方仍需先用 `sanitizeUrl` 拒绝危险协议。
 *
 * @param url 链接目标
 * @returns 可直接写入 `(...)` 的 Markdown 目标
 */
export const formatMarkdownDestination = (url: string): string => {
  const destination = url.replaceAll(markdownDestinationEscapePattern, (char) =>
    encodeURIComponent(char),
  );

  if (!needsAngleBracketDestination(destination))
    return destination.replaceAll(markdownEntityAmpersandPattern, "%26");

  return `<${escapeHtml(destination)}>`;
};

/** 容器正文转义选项 */
export interface EscapeContainerBodySyntaxOptions {
  /**
   * 是否转义行首的 `:::` 容器标记
   *
   * @default true
   */
  container?: boolean;
  /**
   * 围栏代码转义策略
   *
   * - `true`：转义所有行首围栏
   * - `"unclosed"`：仅当正文中存在未闭合围栏时，转义所有行首围栏
   * - `false`：保留围栏
   *
   * @default true
   */
  fence?: boolean | "unclosed";
  /**
   * 是否转义行首的 `#` 标题
   *
   * @default true
   */
  heading?: boolean;
}

/** 行首容器标记：最多三个空格后的三个及以上冒号 */
const containerMarkerPattern = /^(?<indent> {0,3})(?<marker>:{3,})/u;

/** 行首围栏代码：最多三个空格后的三个及以上反引号或波浪号 */
const fencePattern = /^(?<indent> {0,3})(?<fence>`{3,}|~{3,})/u;

/** 行首 ATX 标题：最多三个空格后的 1-6 个 `#`，后接空白 */
const headingPattern = /^(?<indent> {0,3})(?<heading>#{1,6})(?=\s)/u;

/** 行首围栏信息 */
interface FenceMarker {
  /** 围栏字符 */
  char: "`" | "~";
  /** 围栏字符数量 */
  count: number;
  /** 围栏标记后是否只有空白（可作为闭合围栏） */
  bare: boolean;
}

/**
 * 解析行首围栏标记
 *
 * @param line 正文行
 * @returns 围栏信息，不存在时返回 `null`
 */
const getFenceMarker = (line: string): FenceMarker | null => {
  const match = fencePattern.exec(line);

  if (!match) return null;

  const fence = match.groups?.fence ?? "";
  const indent = match.groups?.indent ?? "";

  return {
    char: fence.startsWith("~") ? "~" : "`",
    count: fence.length,
    // 闭合围栏的标记后只能有空白，带信息的行只能作为开启围栏
    bare: line.slice(indent.length + fence.length).trim() === "",
  };
};

/**
 * 判断正文中的围栏代码是否未闭合
 *
 * 按 CommonMark 规则配对：闭合围栏需与开启围栏字符相同、长度不小于开启围栏，且标记后只有空白。
 *
 * @param lines 正文各行
 * @returns 是否存在未闭合的围栏
 */
const hasUnclosedFence = (lines: string[]): boolean => {
  let open: FenceMarker | null = null;

  for (const line of lines) {
    const marker = getFenceMarker(line);

    if (!marker) continue;

    if (!open) open = marker;
    else if (marker.char === open.char && marker.count >= open.count && marker.bare) open = null;
  }

  return open != null;
};

/**
 * 转义容器正文中的块级 Markdown 语法
 *
 * 提示框正文会原样嵌入 `::: type` 容器；正文行首若出现 `:::`，会提前闭合容器。 逐行给这些行首加上反斜杠转义，渲染结果仍是原文字符，但不再被解析为块级语法。
 *
 * 默认转义容器标记、围栏代码与标题，与文本管线既有行为一致；站点管线可按需关闭标题 / 围栏转义， 以保留正常 Markdown 语义，或仅在围栏未成对时转义，避免正常代码块被拍平。
 *
 * @param text 已做 HTML 转义的正文
 * @param options 转义选项
 * @returns 转义后的正文
 */
export const escapeContainerBodySyntax = (
  text: string,
  options: EscapeContainerBodySyntaxOptions = {},
): string => {
  const { container = true, fence = true, heading = true } = options;
  const lines = text.split("\n");
  const shouldEscapeFence = fence === "unclosed" ? hasUnclosedFence(lines) : fence;

  return lines
    .map((line) => {
      let escaped = line;

      if (container)
        escaped = escaped.replace(containerMarkerPattern, String.raw`$<indent>\$<marker>`);

      if (shouldEscapeFence)
        escaped = escaped.replace(fencePattern, String.raw`$<indent>\$<fence>`);

      if (heading) escaped = escaped.replace(headingPattern, String.raw`$<indent>\$<heading>`);

      return escaped;
    })
    .join("\n");
};
