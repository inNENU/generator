import { readFileSync, writeFileSync } from "node:fs";

import { join } from "upath";

import { createPromiseQueue, getFileList } from "../helpers/index.js";
import type { QQAccounts, WechatAccountData, WechatAccounts } from "../schema/index.js";
import { checkQQAccounts, checkWechatAccountData, checkWechatAccounts } from "../schema/index.js";

const decodeText = (text: string): string => {
  const encodedText = text
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
  const shouldWrapWithSingleQuote = !encodedText.includes("'") && encodedText.includes('"');
  const shouldWrapWithDoubleQuote =
    !shouldWrapWithSingleQuote &&
    (['"', ": "].some((item) => encodedText.includes(item)) || encodedText.startsWith("@"));

  return shouldWrapWithSingleQuote
    ? `'${encodedText}'`
    : shouldWrapWithDoubleQuote
      ? `"${encodedText.replaceAll('"', String.raw`\"`)}"`
      : encodedText;
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
  if (check) checkQQAccounts(data, location);

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
  if (check) checkWechatAccounts(data, location);

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
  if (check) checkWechatAccountData(data, location);

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
        const res = await fetch(item);
        const content = await res.text();

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

        console.log(`账号 ${item} 已获取`);

        return {
          original: `- url: ${item}`,
          replacement: `- cover: ${cover}\n    title: ${decodeText(title)}\n${
            desc ? `    desc: ${decodeText(desc)}\n` : ""
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

  writeFileSync(filePath, data, "utf-8");
};

/**
 * 更新文件夹下的所有账号文件
 *
 * @param folder 文件夹
 */
export const updateAccountFiles = async (folder: string): Promise<void> => {
  const fileList = getFileList(folder, "yml");

  await createPromiseQueue(
    fileList.map((item) => (): Promise<void> => updateAccountFile(folder, item)),
  );
};
