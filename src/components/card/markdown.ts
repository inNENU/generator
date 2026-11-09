import { getSafeUrl, sanitizeUrl } from "../../helpers/url.js";
import type { MarkdownOptions } from "../../typings.js";
import { escapeHtml, getFileLink, getHTMLPath, getIconLink } from "../../utils.js";
import type { CardComponentOptions } from "./schema.js";
import { checkCard } from "./schema.js";

/** 卡片可点击区域的目标地址 */
interface CardLink {
  /** 已校验的地址 */
  href: string;
  /** 是否使用站内 RouteLink */
  route: boolean;
}

/**
 * 计算卡片可点击区域的目标地址
 *
 * @param card 卡片组件
 * @param urlConverter 站点 URL 转换器
 * @returns 安全的目标地址，危险或缺失时返回 `null`
 */
const getCardLink = (
  card: CardComponentOptions,
  urlConverter: NonNullable<MarkdownOptions["urlConverter"]>,
): CardLink | null => {
  if ("action" in card) {
    if (card.action === "official") {
      return {
        href: `https://open.weixin.qq.com/qr/code?username=${card.username}`,
        route: false,
      };
    }

    if (card.action === "article") {
      const articleUrl = sanitizeUrl(card.url);

      return articleUrl ? { href: articleUrl, route: false } : null;
    }

    return null;
  }

  if ("path" in card && card.path) {
    const safePath = getSafeUrl(getHTMLPath(card.path));

    return safePath?.kind === "relative" ? { href: safePath.url, route: true } : null;
  }

  if ("url" in card && card.url) {
    const resolvedUrl = sanitizeUrl(urlConverter(card.url));

    return resolvedUrl ? { href: resolvedUrl, route: resolvedUrl.startsWith("/") } : null;
  }

  return null;
};

export const getCardMarkdown = (
  card: CardComponentOptions,
  { location = "", urlConverter = () => null }: MarkdownOptions = {},
): string => {
  if (card.env && !card.env.includes("web")) return "";

  checkCard(card, location);

  const link = getCardLink(card, urlConverter);

  if (!link) return "";

  const logo = sanitizeUrl(getIconLink(card.logo));
  const cover = sanitizeUrl(card.cover ? getFileLink(card.cover) : null);

  const { name, desc, title } = card;

  const cardContent = `\
${
  cover
    ? `\
<img class="innenu-card-cover" src="${escapeHtml(cover)}" alt="" no-view referrerpolicy="no-referer" />
`
    : ""
}
<div class="innenu-card-detail">
  <div class="innenu-card-info">
${
  logo
    ? `\
    <img class="innenu-card-logo" src="${escapeHtml(logo)}" alt="" no-view />
`
    : ""
}\
${
  name
    ? `\
    <div class="innenu-card-name">${escapeHtml(name)}</div>
`
    : ""
}\
  </div>
  <div class="innenu-card-title">${escapeHtml(title)}</div>
${
  desc
    ? `\
  <div class="innenu-card-desc">${escapeHtml(desc)}</div>
`
    : ""
}\
</div>
`;

  return link.route
    ? `\
<RouteLink class="innenu-card" to="${escapeHtml(link.href)}">
${cardContent}
</RouteLink>

`
    : `<a class="innenu-card" href="${escapeHtml(link.href)}" target="_blank">
${cardContent}
</a>`;
};
