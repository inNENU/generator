import { escapeHtml, getAssetIconLink, getFileLink } from "../../utils.js";
import type { DocComponentOptions } from "./schema.js";
import { checkDoc } from "./schema.js";
import { getDocDisplayName, getDocIcon, isPreviewableDoc } from "./utils.js";

export const getDocMarkdown = (doc: DocComponentOptions, location = ""): string => {
  if (doc.env && !doc.env.includes("web")) return "";

  checkDoc(doc, location);

  const processedUrl = getFileLink(doc.url);
  const url = processedUrl ?? doc.url;

  const { name } = doc;

  const docIcon = `<img class="innenu-doc-icon" src="${getAssetIconLink(
    getDocIcon(url),
  )}" alt="" />`;
  const docName = getDocDisplayName(name, url);
  const docNameContent = `<span class="innenu-doc-name">${escapeHtml(docName)}</span>`;
  const downloadable = doc.downloadable !== false;

  return `
${
  isPreviewableDoc(url)
    ? `
<a class="innenu-doc" href="${escapeHtml(url)}" name="${escapeHtml(docName)}" target="_blank" rel="noopener noreferrer">
  ${docIcon}
  ${docNameContent}
</a>
`
    : `
<a class="innenu-doc" href="${escapeHtml(url)}" ${
        downloadable
          ? `download="${escapeHtml(name)}"`
          : 'target="_blank" rel="noopener noreferrer"'
      }>
${docIcon}
${docNameContent}
</a>
`
}
`;
};
