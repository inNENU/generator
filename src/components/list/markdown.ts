import type { MarkdownOptions } from "../../typings.js";
import { escapeHtml, getHTMLPath, getIconLink } from "../../utils.js";
import type { FunctionalListComponentOptions, ListComponentOptions } from "./schema.js";
import { checkFunctionalList, checkList } from "./schema.js";

export const getListMarkdown = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  { location = "", urlHandler = () => null }: MarkdownOptions = {},
): string => {
  if (list.tag === "list") checkList(list, location);
  else checkFunctionalList(list, location);

  const { header, footer, items } = list;

  return `\
${
  header
    ? `\
#### ${header} {.innenu-list-header}

`
    : ""
}\
<div class="innenu-list ${header ? "" : "no-header"}">

${items
  .map((item) => {
    if (item.env && !item.env.includes("web")) return null;

    const { icon, text, desc } = item;

    const resolvedIcon = getIconLink(icon);

    const iconContent = resolvedIcon
      ? `\
<img class="innenu-list-icon" src="${escapeHtml(resolvedIcon)}" alt="" no-view />
`
      : "";

    const textContent = `\
<div class="innenu-list-text">
${text.replaceAll("\n", "<br />")}
</div>
`;

    const descContent = desc
      ? `\
<div class="innenu-list-desc">
${desc}
</div>
`
      : "";

    const listItemContent = `
${iconContent}\
<div class="innenu-list-detail">
${textContent}\
${descContent}\
</div>
`;

    if ("action" in item) {
      if (item.action === "official") {
        return `<a class="innenu-list-item" href="https://open.weixin.qq.com/qr/code?username=${escapeHtml(item.username)}" target="_blank">
${listItemContent}
</a>`;
      }

      if (item.action === "article") {
        return `<a class="innenu-list-item" href="${escapeHtml(item.url)}" target="_blank">
${listItemContent}
</a>`;
      }

      return "";
    }

    if ("path" in item && item.path) {
      return `<RouteLink class="innenu-list-item" to="${escapeHtml(getHTMLPath(item.path))}">
${listItemContent}
</RouteLink>`;
    }

    if ("url" in item && item.url && !("type" in item)) {
      const resolvedUrl = urlHandler(item.url);

      if (resolvedUrl == null) return "";

      return resolvedUrl.startsWith("/")
        ? `<RouteLink class="innenu-list-item" to="${escapeHtml(resolvedUrl)}">
${listItemContent}
</RouteLink>`
        : `<a class="innenu-list-item" href="${escapeHtml(resolvedUrl)}" target="_blank">
${listItemContent}
</a>`;
    }

    return `\
<div class="innenu-list-item">
${listItemContent}
</div>
`;
  })
  .filter((item): item is string => item != null)
  .join("\n")}

</div>
${
  footer
    ? `\
<div class="innenu-list-footer">
${footer}
</div>
`
    : ""
}\

`;
};
