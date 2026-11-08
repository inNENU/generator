/**
 * 获得文档图标
 *
 * @param url 文档地址
 * @returns 文档对应的图标名称
 */
export const getDocIcon = (url: string): string => {
  if (!url) return "";

  const docType = url.split(".").pop();

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
 * 保留现有行为：以 URL 最后一个 `.` 后的内容作为扩展名。
 *
 * @param name 文档名称
 * @param url 文档地址
 * @returns 带扩展名的文档显示名
 */
export const getDocDisplayName = (name: string, url: string): string =>
  `${name}.${url.split(".").pop() ?? ""}`;
