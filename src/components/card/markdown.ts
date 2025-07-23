import type { CardComponentOptions } from "./schema.js";
import { checkCard } from "./schema.js";
import { getFileLink, getHTMLPath, getIconLink } from "../../utils.js";

export const getCardMarkdown = (
  card: CardComponentOptions,
  location = "",
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
<img class="innenu-card-cover" src="${cover}" alt="" no-view referrerpolicy="no-referer" />
`
    : ""
}
<div class="innenu-card-detail">
  <div class="innenu-card-info">
${
  logo
    ? `\
    <img class="innenu-card-logo" src="${logo}" alt="" no-view />
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
    if (card.action === "official")
      return `<a class="innenu-card" href="https://open.weixin.qq.com/qr/code?username=${card.username}" target="_blank">
${cardContent}
</a>`;

    if (card.action === "article") {
      return `<a class="innenu-card" href="${card.url}" target="_blank">
${cardContent}
</a>`;
    }

    return "";
  } else if ("path" in card) {
    return `\
<RouteLink class="innenu-card" to="${getHTMLPath(card.path)}">
${cardContent}
</RouteLink>

`;
  }

  return "";
};
