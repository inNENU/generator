import { checkKeys } from "@mr-hope/assert-type";

import type { CarouselComponentOptions } from "./typings.js";
import { checkFile, resolveStyle } from "../../utils.js";

export const getCarouselJSON = (
  carousel: CarouselComponentOptions,
  location = "",
): CarouselComponentOptions => {
  carousel.images?.forEach((link, index) => {
    // `$` alias resolve and file check
    checkFile(link, `${location}[${index}]`);
  });

  // 处理样式
  if (typeof carousel.style === "object")
    carousel.style = resolveStyle(carousel.style);

  checkKeys(
    carousel,
    {
      tag: "string",
      images: "string[]",
      fill: ["boolean", "undefined"],
      class: ["string", "undefined"],
      style: ["string", "undefined"],
      indicatorDots: ["boolean", "undefined"],
      dotColor: ["string", "undefined"],
      dotActiveColor: ["string", "undefined"],
      autoplay: ["boolean", "undefined"],
      interval: ["number", "undefined"],
      duration: ["number", "undefined"],
      circular: ["boolean", "undefined"],
      vertical: ["boolean", "undefined"],
      preMargin: ["string", "undefined"],
      nextMargin: ["string", "undefined"],
      change: ["string", "undefined"],
      animation: ["string", "undefined"],
      imgClass: ["string", "undefined"],
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
      env: ["string[]", "undefined"],
    },
    location,
  );

  return carousel;
};
