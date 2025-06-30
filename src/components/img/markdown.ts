import { basename } from "node:path";

import type { ImageComponentOptions } from "./schema.js";
import { checkImage } from "./schema.js";
import { getFileLink } from "../../utils.js";

export const getImgMarkdown = (img: ImageComponentOptions): string => {
  if (img.env && !img.env.includes("web")) return "";

  checkImage(img);

  const processedSrc = getFileLink(img.src);
  const src = processedSrc ?? img.src;

  const { desc } = img;

  return `\
<figure>
  <img src="${src}" alt="${desc ?? basename(src).replace(/\..+$/, "")}" />
  ${desc ? `<figcaption>${desc}</figcaption>` : ""}
</figure>

`;
};
