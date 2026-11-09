/**
 * SVG 转换
 *
 * @param content SVG 内容
 * @returns 转换后的 Data URI
 * @internal
 */
export const convertSVGToDataURI = (content: string): string =>
  `data:image/svg+xml,${encodeURIComponent(content)}`;

/**
 * SVG 转换为 Base64 Data URI
 *
 * @param content SVG 内容
 * @returns 转换后的 Base64 Data URI
 * @internal
 */
export const convertSVGToBase64DataURI = (content: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(content, "utf-8").toString("base64")}`;
