import path from "node:path";

/**
 * 取文档 URL 的路径部分（去掉查询串与 hash）
 *
 * @param url 文档地址
 * @returns 文档路径
 */
const getDocPathname = (url: string): string => {
  if (!url) return "";

  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/u)[0] ?? "";
  }
};

/**
 * 取文档扩展名
 *
 * @param url 文档地址
 * @returns 小写扩展名（不含点），无法识别时为空串
 */
const getDocExtension = (url: string): string =>
  path.posix.extname(getDocPathname(url)).replace(/^\./u, "").toLowerCase();

/**
 * 判断文档是否可在线预览
 *
 * @param url 文档地址
 * @returns 是否可由浏览器直接预览
 */
export const isPreviewableDoc = (url: string): boolean =>
  ["pdf", "jpg", "jpeg", "png", "bmp", "svg"].includes(getDocExtension(url));

/**
 * 获得文档图标
 *
 * @param url 文档地址
 * @returns 文档对应的图标名称
 */
export const getDocIcon = (url: string): string => {
  if (!url) return "";

  const docType = getDocExtension(url);

  return docType === "docx" || docType === "doc"
    ? "doc"
    : docType === "pptx" || docType === "ppt"
      ? "ppt"
      : docType === "xlsx" || docType === "xls"
        ? "xls"
        : docType === "jpg" || docType === "jpeg" || docType === "jfif"
          ? "jpg"
          : docType === "mp4" || docType === "mov" || docType === "avi" || docType === "rmvb"
            ? "video"
            : docType === "pdf"
              ? "pdf"
              : docType === "png" || docType === "gif"
                ? docType
                : "document";
};

/**
 * 获得文档显示名
 *
 * 以 URL 路径部分的扩展名为准；名称已带同扩展名时不重复追加，无法识别扩展名时原样返回名称。
 *
 * @param name 文档名称
 * @param url 文档地址
 * @returns 带扩展名的文档显示名
 */
export const getDocDisplayName = (name: string, url: string): string => {
  const extension = getDocExtension(url);

  if (!extension || name.toLowerCase().endsWith(`.${extension}`)) return name;

  return `${name}.${extension}`;
};
