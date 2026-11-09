import { sanitizeUrl } from "../../helpers/url.js";
import { formatMarkdownDestination, getFileLink } from "../../utils.js";
import type { CarouselComponentOptions } from "./schema.js";
import { checkCarousel } from "./schema.js";

/**
 * 生成 carousel 组件 Markdown
 *
 * 与文本管线保持一致：按图片顺序输出 Markdown 图片列表，`$` 前缀的本地资源会转换为完整资源地址。
 *
 * @param carousel 轮播图组件
 * @param location 组件位置
 * @returns Markdown 内容
 */
export const getCarouselMarkdown = (carousel: CarouselComponentOptions, location = ""): string => {
  if (carousel.env && !carousel.env.includes("web")) return "";

  checkCarousel(carousel, location);

  const images = carousel.images
    .map((link) => sanitizeUrl(getFileLink(link)))
    .filter((link): link is string => Boolean(link));

  return images.length > 0
    ? `${images.map((link) => `![''](${formatMarkdownDestination(link)})`).join("\n\n")}\n\n`
    : "";
};
