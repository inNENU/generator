/**
 * 复制对象，并丢弃为空的 `path` 字段
 *
 * 组件生成时路径可能为 `null` 或空字符串，此时不应把空路径写入生成结果
 *
 * @param item 带有可选 `path` 字段的对象
 * @returns 不含空 `path` 的副本
 */
export const omitEmptyPath = <T extends object>(item: T): T => {
  const data = { ...item } as Record<string, unknown>;

  if (!data.path) delete data.path;

  return data as unknown as T;
};
