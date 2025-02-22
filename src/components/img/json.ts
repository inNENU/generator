import { checkKeys } from "@mr-hope/assert-type";

import type { ImageComponentOptions } from "./typings.js";
import { checkFile } from "../../utils.js";

export const getImgJSON = (
  img: ImageComponentOptions,
  location = "",
): ImageComponentOptions => {
  checkFile(img.src, location);

  checkKeys(
    img,
    {
      tag: "string",
      src: "string",
      desc: ["string", "undefined"],
      lazy: ["boolean", "undefined"],
      watermark: ["boolean", "undefined"],
      imgMode: {
        type: ["string", "undefined"],
        enum: [
          "widthFix",
          "scaleToFill",
          "aspectFit",
          "aspectFill",
          "top",
          "bottom",
          "center",
          "left",
          "right",
          "top left",
          "top right",
          "bottom left",
          "bottom right",
          undefined,
        ],
      },
      menu: ["boolean", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return img;
};
