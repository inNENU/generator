import { basename } from "node:path";

import type { ImageComponentOptions } from "./typings.js";
import { getFileLink } from "../../utils.js";

export const getImgMarkdown = (img: ImageComponentOptions): string => {
  img.src = getFileLink(img.src);

  const { src, desc } = img;

  return `\
<figure>
  <img src="${src}" alt="${desc ?? basename(src).replace(/\..+$/, "")}" />
  ${desc ? `<figcaption>${desc}</figcaption>` : ""}
</figure>

`;
};
