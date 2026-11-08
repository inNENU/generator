import { ValidationError } from "../helpers/validation.js";
import type { PageIndexes } from "../schema/index.js";
import { checkPageIndexes } from "../schema/index.js";

/**
 * 获取页面索引数据 JSON
 *
 * @param data 页面索引数据
 * @param location 数据所在位置
 * @param options 生成选项
 * @param options.check 是否进行完整性校验，为 `false` 时跳过校验
 * @returns 页面索引数据
 */
export const getPageIndexesJSON = (
  data: PageIndexes,
  location: string,
  { check = true }: { check?: boolean } = {},
): PageIndexes => {
  if (check) {
    const issues = checkPageIndexes(data, location);

    if (issues.length) throw new ValidationError(`${location} 页面索引校验失败`, issues);
  }

  return data;
};
