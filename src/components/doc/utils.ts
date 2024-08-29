/**
 * 获得文档图标
 *
 * @param url 文档地址
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
          : docType === "mp4" ||
              docType === "mov" ||
              docType === "avi" ||
              docType === "rmvb"
            ? "video"
            : docType === "pdf"
              ? "pdf"
              : docType === "png" || docType === "gif"
                ? docType
                : "document";
};
