/** 安全 URL 的类型 */
export type SafeUrlKind = "http" | "mailto" | "relative" | "tel";

/** 经过协议校验的 URL */
export interface SafeUrl {
  /** 可安全写入 `href`、`src` 或 Markdown 链接的地址 */
  url: string;
  /** 地址类型 */
  kind: SafeUrlKind;
}

/** 允许的协议 */
const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);

/** 协议名匹配 */
const schemePattern = /^(?<scheme>[a-z][a-z0-9+.-]*):/iu;

/** `tel:` 只允许电话号码字符，避免把任意内容当作可执行地址 */
const telPattern = /^tel:\+?[0-9][0-9\s().-]*$/iu;

/** `mailto:` 只允许普通邮箱地址与可选查询串 */
const mailtoPattern = /^mailto:[^\s@]+@[^\s@]+(?:\?[^\s]*)?$/iu;

/** 原始 URL 中不允许出现的控制字符 */
const controlPattern = /\p{Cc}/u;

/** HTML 字符引用匹配 */
const characterReferencePattern =
  /&(?:#(?<decimal>\d{1,7})|#x(?<hex>[0-9a-f]{1,6})|(?<name>[a-z][a-z0-9]{1,31}));?/giu;

/** HTML 中与 URL 混淆相关的常见命名实体 */
const namedCharacterReferences: Record<string, string> = {
  amp: "&",
  colon: ":",
  equals: "=",
  lpar: "(",
  newline: "\n",
  nbsp: "\u00A0",
  num: "#",
  period: ".",
  quest: "?",
  rpar: ")",
  sol: "/",
  tab: "\t",
};

/**
 * 解码 HTML 字符引用
 *
 * 仅用于校验，不会把解码后的内容写回产物。浏览器会在解析属性值时解码字符引用， 因此需要先把 `&#106;avascript:` 之类的变体还原后再判断协议。
 *
 * @param value 待解码的 URL
 * @returns 解码后的 URL
 */
const decodeCharacterReferences = (value: string): string => {
  let current = value;

  // 多层编码（如 `&amp;#106;`）也按最坏情况还原，最多三轮。
  for (let round = 0; round < 3; round += 1) {
    const next = current.replaceAll(
      characterReferencePattern,
      (entity: string, decimal?: string, hex?: string, name?: string) => {
        if (decimal) {
          const codePoint = Number(decimal);

          return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
        }

        if (hex) {
          const codePoint = Number.parseInt(hex, 16);

          return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
        }

        const named = name ? namedCharacterReferences[name.toLowerCase()] : "";

        return named || entity;
      },
    );

    if (next === current) break;

    current = next;
  }

  return current;
};

/**
 * 为协议判断规范化 URL
 *
 * 浏览器会忽略协议中的 ASCII 空白与控制字符，因此校验时先去除这些字符，避免 `java\tscript:` 之类绕过。
 *
 * @param value 原始 URL
 * @returns 用于协议判断的 URL
 */
const normalizeForValidation = (value: string): string =>
  decodeCharacterReferences(value).replaceAll(/[\p{Cc}\s]/gu, "");

/**
 * 校验用户可控 URL
 *
 * 只允许站内相对地址、`http:`、`https:`、`mailto:` 与电话号码形式的 `tel:`。 拒绝
 * `javascript:`、`data:`、`vbscript:`、`file:` 等其他协议，以及协议相对地址（`//evil.example`）、反斜杠、控制字符和 HTML
 * 字符引用混淆。
 *
 * @param value 待校验的 URL
 * @returns 安全 URL 及类型，危险或不合法时返回 `null`
 */
export const getSafeUrl = (value: string | null | undefined): SafeUrl | null => {
  if (typeof value !== "string") return null;

  const url = value.trim();

  if (!url || controlPattern.test(url)) return null;

  const normalized = normalizeForValidation(url);

  if (!normalized) return null;

  // 协议相对地址与反斜杠都会被浏览器当作新的主机名处理。
  if (normalized.startsWith("//") || normalized.includes("\\")) return null;

  const match = schemePattern.exec(normalized);

  if (!match) return { url, kind: "relative" };

  const scheme = match.groups?.scheme.toLowerCase() ?? "";

  if (!allowedSchemes.has(scheme)) return null;

  if (scheme === "mailto") return mailtoPattern.test(normalized) ? { url, kind: "mailto" } : null;

  if (scheme === "tel") return telPattern.test(normalized) ? { url, kind: "tel" } : null;

  return { url, kind: "http" };
};

/**
 * 校验并返回可安全输出的 URL
 *
 * @param value 待校验的 URL
 * @returns 安全 URL，危险或不合法时返回 `null`
 */
export const sanitizeUrl = (value: string | null | undefined): string | null =>
  getSafeUrl(value)?.url ?? null;
