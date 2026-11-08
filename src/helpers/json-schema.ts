import type * as zod from "zod";

/**
 * 完成 JSON Schema 的收尾处理
 *
 * `toJSONSchema` 会把根节点的 `title` 与 `$ref` 放在同一层，而 draft-07 中 `$ref` 会忽略同级关键字，导致标题丢失。这里把根 `$ref` 包进
 * `allOf`， 让 `title` 等元数据保留下来。
 *
 * @param jsonSchema Zod 生成的 JSON Schema
 * @param title 根节点标题
 * @returns 收尾后的 JSON Schema
 */
export const finalizeJsonSchema = (
  jsonSchema: zod.core.JSONSchema.JSONSchema,
  title?: string,
): zod.core.JSONSchema.JSONSchema => {
  const { $ref, title: existingTitle, ...rest } = jsonSchema;
  const rootTitle = title ?? existingTitle;

  if (!$ref) return rootTitle ? { ...jsonSchema, title: rootTitle } : jsonSchema;

  return {
    ...rest,
    ...(rootTitle ? { title: rootTitle } : {}),
    allOf: [{ $ref }],
  };
};
