import { readFileSync } from "node:fs";

import { join } from "upath";

import { getFileList } from "./getFileList.js";
import { ValidationError } from "./validation.js";

/** 扫描引用时使用的页面文件扩展名 */
const pageExtensions = ["yml", "yaml"] as const;

/**
 * 转义正则表达式元字符
 *
 * @param value 原始字符串
 * @returns 可安全用于正则表达式的字符串
 */
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/**
 * 移除资源引用中的查询串与锚点
 *
 * @param link 原始引用
 * @returns 不含 `?query` 与 `#hash` 的引用
 */
const stripUrlSuffix = (link: string): string =>
  link.replaceAll(/[?#].*$/gu, "").replaceAll(/\r$/gu, "");

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
 * 检查资源文件是否被使用
 *
 * 资源引用支持携带 `?query` 与 `#hash`；页面文件同时扫描 `.yml` 与 `.yaml`。
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

  const assetRegExp = new RegExp(
    `\\$((?:${assetFolders.map((folder) => escapeRegExp(folder)).join("|")})/.*)$`,
    "gmu",
  );

  pageFolders
    .flatMap((folder) =>
      pageExtensions.flatMap((ext) => getFileList(folder, ext).map((path) => join(folder, path))),
    )
    .forEach((path) => {
      [...readFileSync(path, { encoding: "utf-8" }).matchAll(assetRegExp)].forEach(
        ([, assetLink]) => {
          assets.delete(stripUrlSuffix(assetLink));
        },
      );
    });

  const unusedAssets = [...assets];

  console.log("未使用的资源:");
  unusedAssets.forEach((asset) => {
    console.log(asset);
  });

  if (strict && unusedAssets.length > 0)
    throw new ValidationError("发现未使用的资源", unusedAssets);

  return unusedAssets;
};
