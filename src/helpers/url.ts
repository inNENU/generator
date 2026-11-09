/**
 * 安全 URL 的类型
 *
 * @internal
 */
export type SafeUrlKind = "http" | "mailto" | "relative" | "tel";

/**
 * 经过协议校验的 URL
 *
 * @internal
 */
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

/**
 * 校验 `mailto:` 地址
 *
 * 只允许普通邮箱地址与可选查询串：恰好一个 `@` 分隔非空的本地部分与域名，`@` 之前不允许空白（调用前已清理）， 查询串从域名内的 `?` 开始并允许包含 `@`。
 *
 * 手写线性扫描而不是正则，避免在恶意构造的重复 `@`/`?` 输入上触发灾难性回溯。
 *
 * @param normalized 已规范化的 URL
 * @returns 是否为可接受的 `mailto:` 地址
 */
const isMailtoAddress = (normalized: string): boolean => {
  const rest = normalized.slice("mailto:".length);
  const firstAt = rest.indexOf("@");

  if (firstAt <= 0) return false;

  const secondAt = rest.indexOf("@", firstAt + 1);

  if (secondAt === -1) return rest.length > firstAt + 1;

  // 出现第二个 `@` 时，必须有一个 `?` 在第一个 `@` 之后、第二个 `@` 之前开始查询串，
  // 且域名部分非空（`firstAt + 2` 起找 `?`）
  for (let index = firstAt + 2; index < secondAt; index += 1) if (rest[index] === "?") return true;

  return false;
};

/** 原始 URL 中不允许出现的控制字符 */
const controlPattern = /\p{Cc}/u;

/** HTML 字符引用匹配 */
const characterReferencePattern =
  /&(?:#(?<decimal>\d+)|#x(?<hex>[0-9a-f]+)|(?<name>[a-z][a-z0-9]{1,31}));?/giu;

/** 解码字符引用的最大轮次，防止深层嵌套引用造成 DoS */
const maxCharacterReferenceRounds = 10;

/** 解码结果 */
interface DecodedCharacterReferences {
  /** 解码后的内容 */
  value: string;
  /** 是否在轮次上限内解码至稳定 */
  stable: boolean;
}

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
 * 解码一轮 HTML 字符引用
 *
 * @param input 待解码内容
 * @returns 解码一轮后的内容
 */
const decodeCharacterReferencesOnce = (input: string): string =>
  input.replaceAll(
    characterReferencePattern,
    (entity: string, decimal?: string, hex?: string, name?: string) => {
      if (decimal) {
        const codePoint = Number(decimal);

        return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      }

      if (hex) {
        const codePoint = Number.parseInt(hex, 16);

        return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      }

      const named = name ? namedCharacterReferences[name.toLowerCase()] : "";

      return named || entity;
    },
  );

/**
 * 解码 HTML 字符引用
 *
 * 仅用于校验，不会把解码后的内容写回产物。浏览器会在解析属性值时解码字符引用， 因此需要先把 `&#106;avascript:` 之类的变体还原后再判断协议。
 *
 * 数字引用不限制位数、命名引用可多层嵌套，这里循环解码至稳定；超过轮次上限仍未稳定时标记为不可信， 交由调用方按不安全处理。
 *
 * @param value 待解码的 URL
 * @returns 解码后的内容及是否稳定
 */
const decodeCharacterReferences = (value: string): DecodedCharacterReferences => {
  let current = value;

  for (let round = 0; round < maxCharacterReferenceRounds; round += 1) {
    const next = decodeCharacterReferencesOnce(current);

    if (next === current) return { value: current, stable: true };

    current = next;
  }

  // 再用一轮探测：仍在变化说明嵌套层数超过上限，不能保证还原后再判断协议是安全的。
  return { value: current, stable: decodeCharacterReferencesOnce(current) === current };
};

/**
 * 为协议判断规范化 URL
 *
 * 浏览器会忽略协议中的 ASCII 空白与控制字符，因此校验时先去除这些字符，避免 `java\tscript:` 之类绕过。
 *
 * @param value 原始 URL
 * @returns 用于协议判断的 URL；字符引用无法在轮次上限内解码时返回 `null`
 */
const normalizeForValidation = (value: string): string | null => {
  const { value: decoded, stable } = decodeCharacterReferences(value);

  return stable ? decoded.replaceAll(/[\p{Cc}\s]/gu, "") : null;
};

/**
 * 校验用户可控 URL
 *
 * 只允许站内相对地址、`http:`、`https:`、`mailto:` 与电话号码形式的 `tel:`。 拒绝
 * `javascript:`、`data:`、`vbscript:`、`file:` 等其他协议，以及协议相对地址（`//evil.example`）、反斜杠、控制字符和 HTML
 * 字符引用混淆。
 *
 * @param value 待校验的 URL
 * @returns 安全 URL 及类型，危险或不合法时返回 `null`
 * @internal
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

  if (scheme === "mailto") return isMailtoAddress(normalized) ? { url, kind: "mailto" } : null;

  if (scheme === "tel") return telPattern.test(normalized) ? { url, kind: "tel" } : null;

  return { url, kind: "http" };
};

/**
 * 校验并返回可安全输出的 URL
 *
 * @param value 待校验的 URL
 * @returns 安全 URL，危险或不合法时返回 `null`
 * @internal
 */
export const sanitizeUrl = (value: string | null | undefined): string | null =>
  getSafeUrl(value)?.url ?? null;
