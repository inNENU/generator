import type * as zod from "zod";

/**
 * 带判别字段值的 schema
 *
 * `zod.discriminatedUnion` 的成员需要提供 `propValues`，而对象、判别联合等 schema 会自动推导该值，普通联合类型不会。此类型用于标注手动补充判别值后的
 * schema。
 */
export type DiscriminatedSchema<Schema extends zod.ZodType> = Schema &
  zod.core.$ZodTypeDiscriminable;

/**
 * 为组合 schema 补充判别字段值
 *
 * 卡片与文本组件由多个对象 schema 组合而成（`zod.union`），本身没有 `tag` 的 判别信息。这里手动补充 `tag` 的取值，使其可以作为
 * `zod.discriminatedUnion` 的成员，同时保留原有成员 schema 与运行时校验行为。
 *
 * @param schema 组合 schema
 * @param values 该 schema 允许的 `tag` 取值
 * @returns 带判别字段值的 schema
 */
export const withDiscriminatorValues = <Schema extends zod.ZodType>(
  schema: Schema,
  values: readonly string[],
): DiscriminatedSchema<Schema> => {
  // `_zod` 是 zod 的内部字段，用于补充普通联合类型缺失的判别信息。
  // oxlint-disable-next-line no-underscore-dangle
  const internals = schema._zod as unknown as {
    propValues: Record<string, Set<unknown>>;
  };

  internals.propValues = { tag: new Set(values) };

  return schema as DiscriminatedSchema<Schema>;
};
