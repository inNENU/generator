import type {PageIndexes} from "../schema/index.js";
import {  checkPageIndex } from "../schema/index.js";

export const getPageIndexesJSON = (
  data: PageIndexes,
  location: string,
): PageIndexes => {
  checkPageIndex(data, location);

  return data;
};
