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

    const iconContent = resolvedIcon
      ? `\
<img class="innenu-list-icon" src="${resolvedIcon}" alt="" no-view />
`
      : "";

    const textContent = `\
<div class="innenu-list-text">
${text.replace(/\n/g, "<br />")}
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

    if ("type" in item) {
      if (item.type === "official")
        return `<a class="innenu-list-item" href="https://open.weixin.qq.com/qr/code?username=${item.username}" target="_blank">
${listItemContent}
</a>`;

      if (item.type === "article") {
        return `<a class="innenu-list-item" href="${item.url}" target="_blank">
${listItemContent}
</a>`;
      }
    } else if ("path" in item && item.path) {
      return `<RouteLink class="innenu-list-item" to="${getHTMLPath(item.path)}">
        ${listItemContent}
        </RouteLink>`;
    }

    return `\
<div class="innenu-list-item">
${listItemContent}
</div>
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
