import type {
  CarouselComponentData,
  CarouselComponentOptions,
} from "./schema.js";
import { checkCarousel } from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getCarouselJSON = (
  carousel: CarouselComponentOptions,
  location = "",
): CarouselComponentData => {
  checkCarousel(carousel, location);

  const { style, ...data } = carousel;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
