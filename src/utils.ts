import { existsSync } from "node:fs";
import path from "node:path";

import { join } from "upath";

import { generatorConfig } from "./config.js";
import { findYamlFile } from "./helpers/yamlPath.js";

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

/** Windows 盘符前缀（如 `C:foo`），盘符相对路径可能跳出资源目录 */
const driveRootPattern = /^[a-z]:/iu;

/** 控制字符；百分号解码后出现时同样拒绝 */
const controlCharPattern = /\p{Cc}/u;

/** 百分号编码的斜杠与反斜杠；URL 解析时会被还原为路径分隔符 */
const encodedSeparatorPattern = /%2f|%5c/iu;

/**
 * 解码资源路径
 *
 * @param value 待解码的路径
 * @returns 解码后的路径，编码不合法时返回 `null`
 */
const decodeAssetPath = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * 判断资源根目录是否可用
 *
 * @param root 规范化后的资源根目录
 * @param inferred 是否从链接中推断（而非调用方显式传入）
 * @returns 资源根目录是否可用
 */
const isValidAssetRoot = (root: string, inferred: boolean): boolean => {
  if (!root || root !== root.trim() || controlCharPattern.test(root)) return false;

  if (invalidAssetRootPattern.test(root)) return false;

  // 推断出的根目录必须是普通字面量：编码字符、盘符相对路径与 UNC 路径都不可信
  if (inferred && (driveRootPattern.test(root) || root.startsWith("//") || root.includes("%")))
    return false;

  const decodedRoot = decodeAssetPath(root);

  if (
    decodedRoot == null ||
    decodedRoot !== decodedRoot.trim() ||
    controlCharPattern.test(decodedRoot)
  )
    return false;

  if (invalidAssetRootPattern.test(decodedRoot)) return false;

  return !(inferred && (driveRootPattern.test(decodedRoot) || decodedRoot.startsWith("//")));
};

/**
 * 解析站内资源链接
 *
 * 资源链接以 `$` 开头，`$` 后的第一段为资源根目录（如 `$img/cover.png` 的 `img`）。解析时会剥离 `?query` 与 `#hash`、把反斜杠统一为正斜杠并做
 * POSIX 规范化；空路径、目录路径、根目录为空/空白/控制字符/`.`/`..`/盘符/UNC 路径的链接，用百分号编码的斜杠或反斜杠（`%2f`/`%5c`）、百分号编码的点段 （如
 * `%2e%2e`）以及用 `..` 逃出根目录的链接都会返回 `null`。字面量 `.`/`..` 段仍按 POSIX 规则归一，但归一后必须留在资源根目录内。
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
  const inferredRoot = root == null;
  const normalizedRoot = (root ?? body.split("/")[0] ?? "")
    .replaceAll("\\", "/")
    .replace(/\/+$/u, "");

  if (!isValidAssetRoot(normalizedRoot, inferredRoot)) return null;

  if (body !== normalizedRoot && !body.startsWith(`${normalizedRoot}/`)) return null;

  // 编码斜杠/反斜杠会在 URL 解析时变成路径分隔符，无法用 POSIX 规范化安全处理
  if (encodedSeparatorPattern.test(body)) return null;

  const decodedBody = decodeAssetPath(body);

  if (decodedBody == null || controlCharPattern.test(decodedBody)) return null;

  const rawSegments = body.split("/");
  const decodedSegments = decodedBody.split("/");

  // 编码点段（`%2e`/`%2e%2e`）在 URL 中会被还原为 `.`/`..`，与字面量点段区别对待
  if (
    rawSegments.length !== decodedSegments.length ||
    decodedSegments.some((segment, index) =>
      segment === ".."
        ? rawSegments[index] !== ".."
        : segment === "."
          ? rawSegments[index] !== "."
          : false,
    )
  )
    return null;

  const resolved = path.posix.normalize(body);

  if (
    resolved === normalizedRoot ||
    resolved.endsWith("/") ||
    !resolved.startsWith(`${normalizedRoot}/`)
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

  if (!findYamlFile(join(generatorConfig.pageFolder, resolvedPath))) {
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
 * 转义 Markdown 链接文字 / 图片替代文字
 *
 * `]` 会提前结束链接文字，`[` 可能开启嵌套链接，反斜杠则会影响转义本身的语义。 生成链接前统一转义，避免链接文字被解释成额外的 Markdown 结构。
 *
 * @param label 链接文字或图片替代文字（应已做 HTML 转义）
 * @returns 可安全写入 `[label]` / `![alt]` 的文字
 */
export const escapeMarkdownLinkLabel = (label: string): string =>
  label
    .replaceAll("\\", String.raw`\\`)
    .replaceAll("[", String.raw`\[`)
    .replaceAll("]", String.raw`\]`)
    .replaceAll(/\r\n|[\r\n]/gu, " ");

/** Markdown 目标地址中必须百分号编码的字符 */
const destinationEncodings: Record<string, string> = {
  "<": "%3C",
  ">": "%3E",
  "\\": "%5C",
};

/** 需要用尖括号包裹才能被 CommonMark 正确解析的目标地址字符 */
const angleBracketDestinationPattern = /[\s()]/u;

/**
 * 格式化 Markdown 链接 / 图片目标地址
 *
 * 直接把 URL 拼进 `[label](destination)` 会被 CommonMark 在空白、`)` 处截断，后续内容因此变成正文， 其中的 `<img onerror>`
 * 等片段会被当成 raw HTML 执行。这里统一处理：
 *
 * - `<`、`>`、反斜杠与控制字符一律百分号编码，URL 无法提前结束目标地址，也无法注入 HTML；
 * - 含空白或圆括号的地址用 `<...>` 包裹，CommonMark 会把它整体当作目标地址。
 *
 * 其余字符保持原样，避免合法地址在产物中发生无意义变化。
 *
 * @param destination 已经过协议校验的目标地址
 * @returns 可安全写入 Markdown 链接的目标地址
 */
export const formatMarkdownDestination = (destination: string): string => {
  if (!destination) return "";

  const encoded = destination
    .replaceAll(
      // oxlint-disable-next-line no-control-regex -- 控制字符必须显式编码，否则会截断 Markdown 目标地址
      /[\u0000-\u001F\u007F]/gu,
      (char) => `%${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(2, "0")}`,
    )
    .replaceAll(/[<>\\]/gu, (char) => destinationEncodings[char] ?? char);

  // 尖括号内的地址允许空白与圆括号，并且仍会被 Markdown 解析为单一目标地址。
  return angleBracketDestinationPattern.test(encoded) ? `<${encoded}>` : encoded;
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
