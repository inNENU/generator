import type { ImageComponentOptions } from "./schema.js";
import { checkImage } from "./schema.js";

export const getImgJSON = (
  img: ImageComponentOptions,
  location = "",
): ImageComponentOptions => {
  checkImage(img, location);

  return img;
};
