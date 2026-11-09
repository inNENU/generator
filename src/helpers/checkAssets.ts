import { readFileSync } from "node:fs";

import { join } from "upath";

import { resolveAssetLink } from "../utils.js";
import { getFileList } from "./getFileList.js";
import { ValidationError } from "./validation.js";
import { parseYaml } from "./yaml.js";
import { YAML_EXTENSIONS } from "./yamlPath.js";

/**
 * 转义正则表达式元字符
 *
 * @param value 原始字符串
 * @returns 可安全用于正则表达式的字符串
 */
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/**
 * 复制忽略规则，移除会影响 `test()` 状态的 `g`/`y` 标志
 *
 * @param ignoreRules 忽略规则列表
 * @returns 可重复安全调用 `test()` 的规则列表
 */
const normalizeIgnoreRules = (ignoreRules: (string | RegExp)[]): (string | RegExp)[] =>
  ignoreRules.map((rule) =>
    rule instanceof RegExp && (rule.global || rule.sticky)
      ? new RegExp(rule.source, rule.flags.replaceAll(/[gy]/gu, ""))
      : rule,
  );

/**
 * 资源引用在解析后字符串中的路径部分
 *
 * YAML 解析后，引号仍然可能作为普通字符存在（如 YAML 只给部分内容加引号、或值本身带引号），Markdown 图片语法则保留 `)`，
 * 因此这些包裹符与空白、行内分隔符都必须作为引用边界；`?query` 与 `#hash` 允许出现在引用中，由 `resolveAssetLink` 统一剥离。
 */
const assetReferencePathPattern = "[^\\s\"'`)\\]}>;,]*";

/**
 * 创建用于在字符串值中提取资源引用的正则表达式
 *
 * 资源文件夹本身可能包含正则元字符或互为前缀（如 `img` 与 `img/sub`），因此需要转义并按长度降序排列。
 *
 * @param assetFolders 资源文件夹列表
 * @returns 匹配完整资源引用的全局正则表达式
 */
const createAssetReferencePattern = (assetFolders: string[]): RegExp => {
  const roots = [...assetFolders]
    .sort((left, right) => right.length - left.length)
    .map((folder) => escapeRegExp(folder));

  return new RegExp(`\\$(?:${roots.join("|")})\\/${assetReferencePathPattern}`, "gu");
};

/**
 * 递归提取值中的资源引用
 *
 * YAML 解析结果只可能通过字符串承载资源引用；数组与对象需要递归遍历，其它标量直接忽略。
 *
 * @param value 解析后的 YAML 值
 * @param pattern 资源引用正则表达式
 * @param onReference 引用回调
 */
const collectAssetReferences = (
  value: unknown,
  pattern: RegExp,
  onReference: (reference: string) => void,
): void => {
  if (typeof value === "string") {
    for (const [reference] of value.matchAll(pattern)) onReference(reference);

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectAssetReferences(item, pattern, onReference);
    });

    return;
  }

  if (value != null && typeof value === "object") {
    Object.values(value).forEach((item) => {
      collectAssetReferences(item, pattern, onReference);
    });
  }
};

/**
 * 检查资源文件是否被使用
 *
 * 页面 YAML 会先用 `parseYaml` 解析，再递归遍历所有字符串值提取资源引用；这样可以避免注释、引号与 Markdown 包裹符造成的误判，
 * 同时支持一行内出现多个引用。资源引用支持携带 `?query` 与 `#hash`；页面文件同时扫描 `.yml` 与 `.yaml`。
 *
 * @param pageFolders 页面文件夹列表
 * @param assetFolders 资源文件夹列表
 * @param ignoreRules 忽略规则列表
 * @param strict 是否在存在未使用资源时抛出 `ValidationError`，默认为 `false`（仅记录日志）
 * @returns 未被使用的资源路径列表
 * @throws {ValidationError} 当 `strict` 为 `true` 且存在未使用资源时抛出
 */
export const checkAssets = (
  pageFolders: string[],
  assetFolders: string[],
  ignoreRules: (string | RegExp)[] = [],
  strict = false,
): string[] => {
  const normalizedIgnoreRules = normalizeIgnoreRules(ignoreRules);

  const assets = new Set(
    assetFolders
      .flatMap((folder) => getFileList(folder).map((path) => join(folder, path)))
      .filter((link) =>
        normalizedIgnoreRules.every((rule) =>
          rule instanceof RegExp ? !rule.test(link) : rule !== link,
        ),
      ),
  );

  const assetReferencePattern = createAssetReferencePattern(assetFolders);
  const seenAssets = new Set<string>();

  pageFolders
    .flatMap((folder) => getFileList(folder, YAML_EXTENSIONS).map((path) => join(folder, path)))
    .forEach((path) => {
      let data: unknown;

      try {
        data = parseYaml(readFileSync(path, { encoding: "utf-8" }), path);
      } catch {
        // 页面 YAML 无法解析时跳过该文件：生成流程会单独报告解析错误，资源检查不应因此中断
        return;
      }

      if (data === void 0) return;

      collectAssetReferences(data, assetReferencePattern, (reference) => {
        const resolved = assetFolders
          .map((folder) => resolveAssetLink(reference, folder))
          .find((result) => result != null);

        if (resolved) seenAssets.add(resolved.path);
      });
    });

  const unusedAssets = [...assets].filter((asset) => !seenAssets.has(asset));

  console.log("未使用的资源:");
  unusedAssets.forEach((asset) => {
    console.log(asset);
  });

  if (strict && unusedAssets.length > 0)
    throw new ValidationError("发现未使用的资源", unusedAssets);

  return unusedAssets;
};
