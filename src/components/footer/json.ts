import type { FooterComponentOptions } from "./schema.js";
import { checkFooter } from "./schema.js";

export const getFooterJSON = (
  footer: FooterComponentOptions,
  location = "",
): FooterComponentOptions => {
  checkFooter(footer, location);

  return footer;
};
