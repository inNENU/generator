import path from "node:path";

import { getFileLink } from "../../utils.js";
import type { ImageComponentOptions } from "./schema.js";
import { checkImage } from "./schema.js";

export const getImgMarkdown = (img: ImageComponentOptions, location = ""): string => {
  if (img.env && !img.env.includes("web")) return "";

  checkImage(img, location);

  const processedSrc = getFileLink(img.src);
  const src = processedSrc ?? img.src;

  const { desc } = img;

  return `\
<figure>
  <img src="${src}" alt="${desc ?? path.basename(src).replace(/\..+$/u, "")}" />
  ${desc ? `<figcaption>${desc}</figcaption>` : ""}
</figure>

`;
};
