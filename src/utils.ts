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

/** 站内资源链接的解析结果 */
export interface ResolvedAssetLink {
  /** 资源根目录（如 `img`、`file`，或 `checkAssets` 传入的资源文件夹） */
  root: string;
  /** 规范化后的资源路径，不含查询串与锚点 */
  path: string;
  /** 查询串与锚点（含起始的 `?` 或 `#`），没有时为空字符串 */
  suffix: string;
}

/** 不可作为资源根目录的片段：`.`、`..` 与 Windows 盘符 */
const invalidAssetRootPattern = /^(?:\.{1,2}|[a-z]:)$/iu;

/**
 * 判断路径中是否包含以百分号编码的点段（如 `%2e%2e`）
 *
 * 这类路径在按 URL 解析时会被还原为 `..`，从而绕过 `..` 检查，因此需要单独拒绝。
 *
 * @param value 待判断的路径
 * @returns 是否包含编码后的点段
 */
const hasEncodedDotSegment = (value: string): boolean =>
  value.split("/").some((segment) => {
    if (!/%2e/iu.test(segment)) return false;

    try {
      const decoded = decodeURIComponent(segment);

      return decoded === "." || decoded === "..";
    } catch {
      return false;
    }
  });

/**
 * 解析站内资源链接
 *
 * 资源链接以 `$` 开头，`$` 后的第一段为资源根目录（如 `$img/cover.png` 的 `img`）。解析时会剥离 `?query` 与 `#hash`、把反斜杠统一为正斜杠并做
 * POSIX 规范化； 空路径、目录路径、根目录为 `.`/`..`/盘符的链接，以及用 `..` 逃出根目录的链接都会返回 `null`。
 *
 * @param link 资源链接
 * @param root 资源根目录；省略时从链接中推断（已知目录的场景可显式传入）
 * @returns 解析结果，链接无效时返回 `null`
 */
export const resolveAssetLink = (link: string, root?: string): ResolvedAssetLink | null => {
  if (typeof link !== "string" || !link.startsWith("$")) return null;

  const suffixIndex = link.search(/[?#]/u);
  const rawLink = (suffixIndex === -1 ? link : link.slice(0, suffixIndex)).trimEnd();
  const suffix = suffixIndex === -1 ? "" : link.slice(suffixIndex);
  const body = rawLink.slice(1).replaceAll("\\", "/");
  const normalizedRoot = (root ?? body.split("/")[0] ?? "")
    .replaceAll("\\", "/")
    .replace(/\/+$/u, "");

  if (!normalizedRoot || invalidAssetRootPattern.test(normalizedRoot)) return null;

  if (body !== normalizedRoot && !body.startsWith(`${normalizedRoot}/`)) return null;

  const resolved = path.posix.normalize(body);

  if (
    resolved === normalizedRoot ||
    resolved.endsWith("/") ||
    !resolved.startsWith(`${normalizedRoot}/`) ||
    hasEncodedDotSegment(resolved)
  )
    return null;

  return { root: normalizedRoot, path: resolved, suffix };
};

/**
 * 检查文件是否存在
 *
 * 站内链接会按当前工作目录（cwd）解析，调用方需要先切换到资源仓库根目录。
 *
 * @param link 文件链接
 * @param location 文件所在位置
 * @returns 校验问题列表
 */
export const checkFile = (link?: string, location = ""): string[] => {
  if (typeof link === "string" && link.startsWith("$")) {
    const folder = link.slice(1).split(/[\\/]/u)[0] ?? "";
    const label = folder === "img" ? "图片" : "文件";
    const resolved = resolveAssetLink(link);

    if (!resolved) {
      const message = `${label} ${link} 不是有效的资源路径${location ? `（位置: ${location}）` : ""}`;

      console.error(message);

      return [message];
    }

    if (!existsSync(`./${resolved.path}`)) {
      const message = `${label} ${link} 不存在${location ? `（位置: ${location}）` : ""}`;

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

  if (!link.startsWith("$")) return link;

  const resolved = resolveAssetLink(link);

  if (!resolved) return null;

  return `${generatorConfig.assets}/${resolved.path}${resolved.suffix}`;
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
