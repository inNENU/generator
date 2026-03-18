import { readFileSync, writeFileSync } from "node:fs";

import upath from "upath";

import { createPromiseQueue, getFileList } from "../helpers/index.js";
import type { QQAccounts, WechatAccountData, WechatAccounts } from "../schema/index.js";
import { checkQQAccounts, checkWechatAccountData, checkWechatAccounts } from "../schema/index.js";

const decodeText = (text: string): string => {
  const encodedText = text
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x0d", " ")
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x0a", " ")
    // oxlint-disable-next-line unicorn/prefer-string-raw
    .replaceAll("\\x26", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll(/ +/g, " ");
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

export const getQQAccountsJSON = (data: QQAccounts, location: string): QQAccounts => {
  checkQQAccounts(data, location);

  return data;
};

export const getWechatAccountsJSON = (data: WechatAccounts, location: string): WechatAccounts => {
  checkWechatAccounts(data, location);

  return data;
};

export const getWechatAccountDataJSON = (
  data: WechatAccountData,
  location: string,
): WechatAccountData => {
  checkWechatAccountData(data, location);

  return data;
};

export const updateAccountFile = async (folder: string, path: string): Promise<void> => {
  const filePath = upath.join(folder, path);

  let data = readFileSync(filePath, "utf-8");

  const results = data
    .split("\n")
    .map((item) => /- url: (.*)$/.exec(item)?.[1] ?? "")
    .filter((item) => item.length);

  await createPromiseQueue(
    results.map((item) => async (): Promise<void> => {
      try {
        const res = await fetch(item);
        const content = await res.text();

        const supportedOGP = content.includes("<meta property");

        const cover = supportedOGP
          ? /<meta property="og:image" content="(.*?)" \/>/.exec(content)?.[1]
          : /msg_cdn_url = "(.*)"/.exec(content)?.[1];
        const title = supportedOGP
          ? /<meta property="og:title" content="(.*?)" \/>/.exec(content)?.[1]
          : /msg_title = '(.*)'/.exec(content)?.[1];
        const desc = supportedOGP
          ? /<meta property="og:description" content="(.*?)" \/>/.exec(content)?.[1]
          : /msg_desc = htmlDecode\("(.*)"\)/.exec(content)?.[1];

        if (typeof cover !== "string" || typeof title !== "string" || typeof desc !== "string") {
          throw new TypeError(
            `Parsing failed: ${JSON.stringify({ supportedOGP, cover, title, desc })}`,
          );
        }

        data = data.replace(
          `- url: ${item}`,
          `- cover: ${cover}\n    title: ${decodeText(title)}\n${
            desc ? `    desc: ${decodeText(desc)}\n` : ""
          }    url: ${item}`,
        );

        console.log(`账号 ${item} 已获取`);
      } catch (err: unknown) {
        console.error(`获取账户 ${item} 失败:`, err);
      }
    }),
    3,
  );

  writeFileSync(filePath, data, "utf-8");
};

export const updateAccountFiles = async (folder: string): Promise<void> => {
  const fileList = getFileList(folder, "yml");

  await createPromiseQueue(
    fileList.map((item) => (): Promise<void> => updateAccountFile(folder, item)),
  );
};
