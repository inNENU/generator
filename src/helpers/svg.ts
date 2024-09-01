/** SVG 转换 */
export const convertSVGToDataURI = (content: string): string =>
  `data:image/svg+xml,${content
    .replace(/"/gu, "'")
    .replace(/</gu, "%3C")
    .replace(/>/gu, "%3E")
    .replace(/#/gu, "%23")}`;

export const convertSVGToBase64DataURI = (content: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(
    unescape(encodeURIComponent(content)),
    "utf8",
  ).toString("base64")}`;
