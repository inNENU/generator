import { readFileSync } from "node:fs";

import { join } from "upath";

import { writeFileAtomically } from "../helpers/generation-manifest.js";
import { createPromiseQueue, getFileList, getYamlValue } from "../helpers/index.js";
import { ValidationError } from "../helpers/validation.js";
import { YAML_EXTENSIONS } from "../helpers/yamlPath.js";
import type { QQAccounts, WechatAccountData, WechatAccounts } from "../schema/index.js";
import { checkQQAccounts, checkWechatAccountData, checkWechatAccounts } from "../schema/index.js";

/** 获取账号页面时的超时时间（毫秒） */
const ACCOUNT_FETCH_TIMEOUT = 10_000;

/**
 * 判断错误是否由请求超时引起
 *
 * Node.js 在 `AbortSignal.timeout` 触发时抛出 `DOMException`，其 `name` 为 `TimeoutError`。
 *
 * @param error 捕获到的错误
 * @returns 是否为超时错误
 */
const isTimeoutError = (error: unknown): boolean =>
  typeof error === "object" && error != null && "name" in error && error.name === "TimeoutError";

/**
 * 解码账号页面抓取到的文本
 *
 * 只做 HTML 实体与转义序列的还原，不负责 YAML 引号；写入 YAML 前需要再经过 `formatAccountText`。
 *
 * @param text 原始文本
 * @returns 解码后的文本
 */
const decodeText = (text: string): string =>
  text
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x0d", " ")
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x0a", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x26", "&")
    .replaceAll(/ +/gu, " ");

/**
 * 将账号页面抓取到的文本序列化为 YAML 标量
 *
 * 复用 `getYamlValue` 的引号与转义逻辑，保证标题、描述里的双引号、反斜杠、换行与 YAML 特殊字符都能被 `js-yaml` 正确 roundtrip。
 *
 * 导出该辅助函数仅为便于测试，调用方仍应使用 `updateAccountFile`。
 *
 * @param text 原始文本
 * @returns 可直接写入 YAML 的标量
 */
export const formatAccountText = (text: string): string => getYamlValue(decodeText(text));

/**
 * 获取账号页面内容
 *
 * 统一处理请求超时与 HTTP 状态码，失败时抛出带 URL 的中文错误，避免把错误页面当成正常内容解析。
 *
 * @param url 账号页面地址
 * @returns 页面内容
 */
export const fetchAccountPage = async (url: string): Promise<string> => {
  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(ACCOUNT_FETCH_TIMEOUT) });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      throw new Error(`获取账号页面超时: ${url}（超过 ${ACCOUNT_FETCH_TIMEOUT / 1000} 秒）`, {
        cause: err,
      });
    }

    throw new Error(
      `获取账号页面失败: ${url}（${err instanceof Error ? err.message : String(err)}）`,
      { cause: err },
    );
  }

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";

    throw new Error(`获取账号页面失败: ${url}（HTTP ${response.status}${statusText}）`);
  }

  return response.text();
};

/**
 * 获取 QQ 账号数据 JSON
 *
 * @param data QQ 账号数据
 * @param location 数据所在位置
 * @param check 是否进行完整性校验
 * @returns QQ 账号数据
 */
export const getQQAccountsJSON = (data: QQAccounts, location: string, check = true): QQAccounts => {
  if (check) {
    const issues = checkQQAccounts(data, location);

    if (issues.length) throw new ValidationError(`${location} QQ 账号校验失败`, issues);
  }

  return data;
};

/**
 * 获取微信公众号账号数据 JSON
 *
 * @param data 微信公众号账号数据
 * @param location 数据所在位置
 * @param check 是否进行完整性校验
 * @returns 微信公众号账号数据
 */
export const getWechatAccountsJSON = (
  data: WechatAccounts,
  location: string,
  check = true,
): WechatAccounts => {
  if (check) {
    const issues = checkWechatAccounts(data, location);

    if (issues.length) throw new ValidationError(`${location} 微信公众号账号校验失败`, issues);
  }

  return data;
};

/**
 * 获取微信公众号账号详情数据 JSON
 *
 * @param data 微信公众号账号详情数据
 * @param location 数据所在位置
 * @param check 是否进行完整性校验
 * @returns 微信公众号账号详情数据
 */
export const getWechatAccountDataJSON = (
  data: WechatAccountData,
  location: string,
  check = true,
): WechatAccountData => {
  if (check) {
    const issues = checkWechatAccountData(data, location);

    if (issues.length) throw new ValidationError(`${location} 微信公众号账号详情校验失败`, issues);
  }

  return data;
};

/**
 * 更新单个账号文件，自动获取文章封面、标题与描述
 *
 * @param folder 文件夹
 * @param path 文件路径
 */
export const updateAccountFile = async (folder: string, path: string): Promise<void> => {
  const filePath = join(folder, path);

  let data = readFileSync(filePath, "utf-8");

  const results = data
    .split("\n")
    .map((item) => /- url: (?<url>.*)$/u.exec(item)?.groups?.url ?? "")
    .filter((item) => item.length);

  const replacements = await createPromiseQueue(
    results.map((item) => async (): Promise<{ original: string; replacement: string }> => {
      try {
        const content = await fetchAccountPage(item);

        const supportedOGP = content.includes("<meta property");

        const cover = supportedOGP
          ? /<meta property="og:image" content="(?<image>.*?)" \/>/u.exec(content)?.[1]
          : /msg_cdn_url = "(?<url>.*)"/u.exec(content)?.[1];
        const title = supportedOGP
          ? /<meta property="og:title" content="(?<title>.*?)" \/>/u.exec(content)?.[1]
          : /msg_title = '(?<title>.*)'/u.exec(content)?.[1];
        const desc = supportedOGP
          ? /<meta property="og:description" content="(?<desc>.*?)" \/>/u.exec(content)?.[1]
          : /msg_desc = htmlDecode\("(?<desc>.*)"\)/u.exec(content)?.[1];

        if (typeof cover !== "string" || typeof title !== "string" || typeof desc !== "string") {
          throw new TypeError(
            `Parsing failed: ${JSON.stringify({ supportedOGP, cover, title, desc })}`,
          );
        }

        return {
          original: `- url: ${item}`,
          replacement: `- cover: ${cover}\n    title: ${formatAccountText(title)}\n${
            desc ? `    desc: ${formatAccountText(desc)}\n` : ""
          }    url: ${item}`,
        };
      } catch (err: unknown) {
        console.error(`获取账户 ${item} 失败:`, err);
        return { original: `- url: ${item}`, replacement: `- url: ${item}` };
      }
    }),
    3,
  );

  for (const { original, replacement } of replacements) data = data.replace(original, replacement);

  writeFileAtomically(filePath, data);
};

/**
 * 更新文件夹下的所有账号文件
 *
 * @param folder 文件夹
 */
export const updateAccountFiles = async (folder: string): Promise<void> => {
  const fileList = getFileList(folder, YAML_EXTENSIONS);

  await createPromiseQueue(
    fileList.map((item) => (): Promise<void> => updateAccountFile(folder, item)),
  );
};
