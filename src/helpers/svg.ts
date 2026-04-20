/**
 * SVG 转换
 *
 * @param content SVG 内容
 * @returns 转换后的 Data URI
 */
export const convertSVGToDataURI = (content: string): string =>
  `data:image/svg+xml,${content
    .replaceAll('"', "'")
    .replaceAll("<", "%3C")
    .replaceAll(">", "%3E")
    .replaceAll("#", "%23")}`;

export const convertSVGToBase64DataURI = (content: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(
    // oxlint-disable-next-line typescript/no-deprecated
    unescape(encodeURIComponent(content)),
    "utf-8",
  ).toString("base64")}`;
