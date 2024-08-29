import type { AudioComponentOptions } from "./typings.js";
import { getFileLink } from "../../utils.js";

export const getAudioMarkdown = ({
  src,
  name,
  author,
}: AudioComponentOptions): string =>
  `\
<VidStack src="${getFileLink(src)}" title="${name ? `名称: ${name}` : ""} ${
    author ? `作者: ${author}` : ""
  }" />

`;
