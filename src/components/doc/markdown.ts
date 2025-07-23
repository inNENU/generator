import type { DocComponentOptions } from "./schema.js";
import { checkDoc } from "./schema.js";
import { getDocIcon } from "./utils.js";
import { getAssetIconLink, getFileLink } from "../../utils.js";

export const getDocMarkdown = (
  doc: DocComponentOptions,
  location = "",
): string => {
  if (doc.env && !doc.env.includes("web")) return "";

  checkDoc(doc, location);

  const processedUrl = getFileLink(doc.url);
  const url = processedUrl ?? doc.url;

  const { name } = doc;

  const docIcon = `<img class="innenu-doc-icon" src="${getAssetIconLink(
    getDocIcon(url),
  )}" alt="" />`;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
