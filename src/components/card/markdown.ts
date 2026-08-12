import type { MarkdownOptions } from "../../typings.js";
import { escapeHtml, getFileLink, getHTMLPath, getIconLink } from "../../utils.js";
import type { CardComponentOptions } from "./schema.js";
import { checkCard } from "./schema.js";

export const getCardMarkdown = (
  card: CardComponentOptions,
  { location = "", urlConverter = () => null }: MarkdownOptions = {},
): string => {
  if (card.env && !card.env.includes("web")) return "";

  checkCard(card, location);

  const logo = getIconLink(card.logo);
  const cover = card.cover ? getFileLink(card.cover) : null;

  const { name, desc, title } = card;

  const cardContent = `
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
    <div class="innenu-card-name">${name}</div>
`
    : ""
}\
  </div>
  <div class="innenu-card-title">${title}</div>
${
  desc
    ? `\
  <div class="innenu-card-desc">${desc}</div>
`
    : ""
}\
</div>
`;

  if ("action" in card) {
    if (card.action === "official") {
      return `<a class="innenu-card" href="https://open.weixin.qq.com/qr/code?username=${escapeHtml(card.username)}" target="_blank">
${cardContent}
</a>`;
    }

    if (card.action === "article") {
      return `<a class="innenu-card" href="${escapeHtml(card.url)}" target="_blank">
${cardContent}
</a>`;
    }

    return "";
  } else if ("path" in card) {
    return `\
<RouteLink class="innenu-card" to="${escapeHtml(getHTMLPath(card.path))}">
${cardContent}
</RouteLink>

`;
  } else if ("url" in card && card.url) {
    const resolvedUrl = urlConverter(card.url);

    if (resolvedUrl == null) return "";

    return resolvedUrl.startsWith("/")
      ? `\
<RouteLink class="innenu-card" to="${escapeHtml(resolvedUrl)}">
${cardContent}
</RouteLink>

`
      : `<a class="innenu-card" href="${escapeHtml(resolvedUrl)}" target="_blank">
${cardContent}
</a>`;
  }

  return "";
};
