import type { CardComponentOptions } from "./typings.js";
import { getFileLink, getHTMLPath, getIconLink } from "../../utils.js";

export const getCardMarkdown = (card: CardComponentOptions): string => {
  const logo = getIconLink(card.logo);
  const cover = card.cover ? getFileLink(card.cover) : null;

  if ("appId" in card) return "";

  const { name, desc, title } = card;

  const cardChildren = `
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

  if ("url" in card && /^https?:\/\//.exec(card.url))
    return `\
<a class="innenu-card" href="${card.url}" target="_blank">
${cardChildren}
</a>
`;

  if ("path" in card) {
    return `\
<RouteLink class="innenu-card" to="${getHTMLPath(card.path)}">
${cardChildren}
</RouteLink>

`;
  }

  return "";
};
