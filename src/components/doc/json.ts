import { checkKeys } from "@mr-hope/assert-type";

import type { DocComponentOptions } from "./typings.js";
import { getDocIcon } from "./utils.js";
import { checkFile } from "../../utils.js";

export const getDocJSON = (
  doc: DocComponentOptions,
  location = "",
): DocComponentOptions => {
  doc.icon = getDocIcon(doc.url);
  checkFile(doc.url, location);

  checkKeys(
    doc,
    {
      tag: "string",
      icon: "string",
      name: "string",
      url: "string",
      downloadable: ["boolean", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return doc;
};
