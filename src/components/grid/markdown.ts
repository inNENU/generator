import type { GridComponentOptions } from "./typings.js";
import { getIconLink, getMarkdownPath } from "../../utils.js";

export const getGridMarkdown = ({
  header,
  footer,
  items = [],
}: GridComponentOptions): string =>
  `\
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
    if ("env" in item && !item.env.includes("web")) return null;
    if ("appId" in item) return null;

    const resolvedIcon = getIconLink(item.icon);

    const gridItemContent = `
${
  resolvedIcon
    ? `<img class="innenu-grid-icon" src="${resolvedIcon}" alt="" no-view />`
    : ""
}
<div class="innenu-grid-text">
${item.text.replace(/\n/g, "<br />")}
</div>
`;

    return `\
${
  "url" in item && /^https?:\/\//.exec(item.url)
    ? `<a class="innenu-grid-item" href="${item.url}" target="_blank">
${gridItemContent}
</a>`
    : "path" in item
      ? `<RouteLink class="innenu-grid-item" to="${getMarkdownPath(item.path)}">
${gridItemContent}
</RouteLink>`
      : `\
<div class="innenu-grid-item">
${gridItemContent}
</div>`
}
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
