import { convertStyle } from "../../utils.js";
import type { CarouselComponentData, CarouselComponentOptions } from "./schema.js";

export const getCarouselJSON = (carousel: CarouselComponentOptions): CarouselComponentData => {
  const { style, ...data } = carousel;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
