import type { DocComponentData, DocComponentOptions } from "./schema.js";
import { getDocIcon } from "./utils.js";

export const getDocJSON = (doc: DocComponentOptions): DocComponentData => ({
  ...doc,
  icon: getDocIcon(doc.url),
});
