import * as zod from "zod";

/** 已编译 schema 缓存（同一 schema 只编译一次） */
const compiledCache = new WeakMap<object, unknown>();

/**
 * 获取 schema 的 AOT 编译副本并缓存
 *
 * 解析性能相比标准解析器提升数倍到数十倍（官方基准 object/union 3–9x，本项目巨型 union 实测 ~70–90x）。编译副本用法与原 schema
 * 完全一致（parse/safeParse/类型/错误均不变）， 可直接替换使用。失败路径不加速（编译只是成功路径的 fast-path，非法输入回退标准解析器）。
 *
 * @param schema 需编译的 Zod schema
 * @returns 编译副本（类型与原 schema 一致）
 */
export const useCompiled = <TSchema extends object & Parameters<typeof zod.compile>[0]>(
  schema: TSchema,
): TSchema => {
  const compiled = compiledCache.get(schema) as TSchema | undefined;

  if (compiled) return compiled;

  const newCompiled = zod.compile(schema);

  compiledCache.set(schema, newCompiled);

  return newCompiled;
};
