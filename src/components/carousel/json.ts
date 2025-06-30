import type {
  CarouselComponentData,
  CarouselComponentOptions,
} from "./schema.js";
import { convertStyle } from "../../utils.js";

export const getCarouselJSON = (
  carousel: CarouselComponentOptions,
): CarouselComponentData => {
  const { style, ...data } = carousel;
  const convertedStyle = convertStyle(style);

  return {
    ...data,
    ...(convertedStyle ? { style: convertedStyle } : {}),
  };
};
