import type { PageIndexes } from "../schema/index.js";
import { checkPageIndexes } from "../schema/index.js";

/**
 * 获取页面索引数据 JSON
 *
 * @param data 页面索引数据
 * @param location 数据所在位置
 * @returns 页面索引数据
 */
export const getPageIndexesJSON = (data: PageIndexes, location: string): PageIndexes => {
  checkPageIndexes(data, location);

  return data;
};
