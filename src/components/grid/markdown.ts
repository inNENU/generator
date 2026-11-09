import { getSafeUrl, sanitizeUrl } from "../../helpers/url.js";
import type { MarkdownOptions } from "../../typings.js";
import { escapeHtml, getHTMLPath, getIconLink, normalizeInlineText } from "../../utils.js";
import type { GridComponentOptions } from "./schema.js";
import { checkGrid } from "./schema.js";

export const getGridMarkdown = (
  grid: GridComponentOptions,
  { location = "", urlConverter = () => null }: MarkdownOptions = {},
): string => {
  if (grid.env && !grid.env.includes("web")) return "";

  checkGrid(grid, location);

  const { header, footer, items } = grid;

  return `\
${
  header
    ? `\
#### ${escapeHtml(normalizeInlineText(header))} {.innenu-grid-header}

`
    : ""
}\
<div class="innenu-grid">

${items
  .map((item) => {
    if ("env" in item && item.env && !item.env.includes("web")) return null;

    const { icon, text } = item;
    const resolvedIcon = sanitizeUrl(getIconLink(icon));

    const iconContent = resolvedIcon
      ? `\
<img class="innenu-grid-icon" src="${escapeHtml(resolvedIcon)}" alt="" no-view />
`
      : "";

    const textContent = `\
<div class="innenu-grid-text">
${escapeHtml(text).replaceAll("\n", "<br />")}
</div>
`;

    const gridItemContent = `\
${iconContent}\
${textContent}\
`;

    if ("action" in item) {
      if (item.action === "official") {
        return `<a class="innenu-grid-item" href="https://open.weixin.qq.com/qr/code?username=${escapeHtml(item.username)}" target="_blank">
${gridItemContent}
</a>`;
      }

      if (item.action === "article") {
        const articleUrl = sanitizeUrl(item.url);

        if (!articleUrl) return "";

        return `<a class="innenu-grid-item" href="${escapeHtml(articleUrl)}" target="_blank">
${gridItemContent}
</a>`;
      }

      return "";
    }

    if ("path" in item && item.path) {
      const safePath = getSafeUrl(getHTMLPath(item.path));

      if (safePath?.kind !== "relative") return "";

      return `<RouteLink class="innenu-grid-item" to="${escapeHtml(safePath.url)}">
${gridItemContent}
</RouteLink>`;
    }

    if ("url" in item && item.url) {
      const resolvedUrl = sanitizeUrl(urlConverter(item.url));

      if (!resolvedUrl) return "";

      return resolvedUrl.startsWith("/")
        ? `<RouteLink class="innenu-grid-item" to="${escapeHtml(resolvedUrl)}">
${gridItemContent}
</RouteLink>`
        : `<a class="innenu-grid-item" href="${escapeHtml(resolvedUrl)}" target="_blank">
${gridItemContent}
</a>`;
    }

    return `\
<div class="innenu-grid-item">
${gridItemContent}
</div>
`;
  })
  .filter((item): item is string => item != null)
  .join("\n")}

</div>

${
  footer
    ? `\
<div class="innenu-grid-footer">
${escapeHtml(footer)}
</div>
`
    : ""
}\

`;
};
