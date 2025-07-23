import type { GridComponentOptions } from "./schema.js";
import { checkGrid } from "./schema.js";
import { getHTMLPath, getIconLink } from "../../utils.js";

export const getGridMarkdown = (
  grid: GridComponentOptions,
  location = "",
): string => {
  if (grid.env && !grid.env.includes("web")) return "";

  checkGrid(grid, location);

  const { header, footer, items = [] } = grid;

  return `\
${
  header
    ? `\
#### ${header} {.innenu-grid-header}

`
    : ""
}\
<div class="innenu-grid">

${items
  .map((item) => {
    if ("env" in item && item.env && !item.env.includes("web")) return null;
    if ("appId" in item) return null;

    const { icon, text } = item;
    const resolvedIcon = getIconLink(icon);

    const iconContent = resolvedIcon
      ? `\
<img class="innenu-grid-icon" src="${resolvedIcon}" alt="" no-view />
`
      : "";

    const textContent = `\
<div class="innenu-grid-text">
${text.replace(/\n/g, "<br />")}
</div>
`;

    const gridItemContent = `\
${iconContent}\
${textContent}\
`;

    if ("action" in item) {
      if (item.action === "official")
        return `<a class="innenu-grid-item" href="https://open.weixin.qq.com/qr/code?username=${item.username}" target="_blank">
${gridItemContent}
</a>`;

      if (item.action === "article") {
        return `<a class="innenu-grid-item" href="${item.url}" target="_blank">
${gridItemContent}
</a>`;
      }

      return "";
    } else if ("path" in item && item.path) {
      return `<RouteLink class="innenu-grid-item" to="${getHTMLPath(item.path)}">
        ${gridItemContent}
        </RouteLink>`;
    }

    return `\
<div class="innenu-grid-item">
${gridItemContent}
</div>
`;
  })
  .filter((item): item is string => item !== null)
  .join("\n")}

</div>

${
  footer
    ? `\
<div class="innenu-grid-footer">
${footer}
</div>
`
    : ""
}\

`;
};
