import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "./schema.js";
import { getHTMLPath, getIconLink } from "../../utils.js";

export const getListMarkdown = ({
  header,
  footer,
  items = [],
}: ListComponentOptions | FunctionalListComponentOptions): string =>
  `\
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
    if ("appId" in item) return null;

    const { icon, text, desc } = item;

    const resolvedIcon = getIconLink(icon);

    const listItemContent = `
${
  resolvedIcon
    ? `<img class="innenu-list-icon" src="${resolvedIcon}" alt="" no-view />`
    : ""
}
<div class="innenu-list-detail">
<div class="innenu-list-text">
${text.replace(/\n/g, "<br />")}
</div>
${
  desc
    ? `\
<div class="innenu-list-desc">
${desc}
</div>
`
    : ""
}
</div>
`;

    return `\
${
  "url" in item && item.url && /^https?:\/\//.exec(item.url)
    ? `<a class="innenu-list-item" href="${item.url}" target="_blank">
${listItemContent}
</a>`
    : "path" in item && item.path
      ? `<RouteLink class="innenu-list-item" to="${getHTMLPath(item.path)}">
${listItemContent}
</RouteLink>`
      : `\
<div class="innenu-list-item">
${listItemContent}
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
<div class="innenu-list-footer">
${footer}
</div>
`
    : ""
}\

`;
