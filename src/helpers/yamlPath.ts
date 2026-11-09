import { existsSync } from "node:fs";

/**
 * 支持的 YAML 源文件扩展名（不含 `.`）
 *
 * 与文件名匹配时区分大小写，因此仅支持小写 `.yml` / `.yaml`；`.YML` / `.YAML` 不会被识别为 YAML 源文件。
 */
export const YAML_EXTENSIONS = ["yml", "yaml"] as const;

/**
 * 去掉路径末尾的 YAML 扩展名
 *
 * @param filePath 文件路径
 * @returns 不含 `.yml` / `.yaml` 的路径
 */
export const stripYamlExtension = (filePath: string): string => filePath.replace(/\.ya?ml$/u, "");

/**
 * 查找带 YAML 扩展名的文件
 *
 * 依次尝试 `.yml` 与 `.yaml`，返回第一个存在的路径；两者同时存在时优先 `.yml`。
 *
 * @param basePath 不含扩展名的文件路径
 * @returns 实际存在的文件路径，不存在时返回 `undefined`
 */
export const findYamlFile = (basePath: string): string | undefined =>
  YAML_EXTENSIONS.map((extension) => `${basePath}.${extension}`).find((filePath) =>
    existsSync(filePath),
  );
