import type { DocComponentData, DocComponentOptions } from "./schema.js";
import { checkDoc } from "./schema.js";
import { getDocIcon } from "./utils.js";

export const getDocJSON = (
  doc: DocComponentOptions,
  location = "",
): DocComponentData => {
  checkDoc(doc, location);

  return { ...doc, icon: getDocIcon(doc.url) };
};
