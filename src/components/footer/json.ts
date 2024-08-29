import { checkKeys } from "@mr-hope/assert-type";

import type { FooterComponentOptions } from "./typings.js";

export const getFooterJSON = (
  footer: FooterComponentOptions,
  location = "",
): FooterComponentOptions => {
  checkKeys(
    footer,
    {
      tag: "string",
      author: ["string", "undefined"],
      time: ["string", "undefined"],
      desc: ["string", "undefined"],
      env: ["string[]", "undefined"],
      cite: ["string[]", "undefined"],
    },
    location,
  );

  return footer;
};
