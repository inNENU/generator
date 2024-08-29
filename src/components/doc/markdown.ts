import type { DocComponentOptions } from "./typings.js";
import { getDocIcon } from "./utils.js";
import { getAssetIconLink, getFileLink } from "../../utils.js";

export const getDocMarkdown = (doc: DocComponentOptions): string => {
  doc.url = getFileLink(doc.url);

  const { name, url } = doc;

  const docIcon = `<img class="innenu-doc-icon" src="${getAssetIconLink(
    getDocIcon(url),
  )}" alt="" />`;
  const docName = `${name}.${url.split(".").pop()!}`;

  return `
${
  /\.(pdf|jpe?g|png|bmp|svg)$/.exec(url)
    ? `
<a class="innenu-doc" href="${url}" name="${docName}" target="_blank" rel="noopener noreferrer">
  ${docIcon}
  ${docName}
</a>
`
    : `
<a class="innenu-doc" href="${url}" download="${name}">${docIcon}${docName}</a>
`
}
`;
};
