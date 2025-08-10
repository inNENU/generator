import type { PageIndexes } from "../schema/index.js";
import { checkPageIndexes } from "../schema/index.js";

export const getPageIndexesJSON = (
  data: PageIndexes,
  location: string,
): PageIndexes => {
  checkPageIndexes(data, location);

  return data;
};
