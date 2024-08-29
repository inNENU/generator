import type { VideoComponentOptions } from "./typings.js";
import { getFileLink } from "../../utils.js";

export const getVideoMarkdown = ({
  src,
  poster,
  title,
}: VideoComponentOptions): string =>
  `\
<VidStack src="${getFileLink(src)}"${title ? ` title="${title}"` : ""}${
    poster ? ` poster="${poster}"` : ""
  } />

`;
