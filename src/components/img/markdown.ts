import path from "node:path";

import { sanitizeUrl } from "../../helpers/url.js";
import { escapeHtml, getFileLink } from "../../utils.js";
import type { ImageComponentOptions } from "./schema.js";
import { checkImage } from "./schema.js";

export const getImgMarkdown = (img: ImageComponentOptions, location = ""): string => {
  if (img.env && !img.env.includes("web")) return "";

  checkImage(img, location);

  const src = sanitizeUrl(getFileLink(img.src) ?? img.src);

  if (!src) return "";

  const { desc } = img;

  return `\
<figure>
  <img src="${escapeHtml(src)}" alt="${escapeHtml(desc ?? path.basename(src).replace(/\..+$/u, ""))}" />
  ${desc ? `<figcaption>${escapeHtml(desc)}</figcaption>` : ""}
</figure>

`;
};
