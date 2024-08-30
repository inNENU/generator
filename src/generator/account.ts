import { readFileSync, writeFileSync } from "node:fs";

import upath from "upath";

import type {
  QQAccountsConfig,
  WechatAccountConfig,
  WechatAccountsConfig,
} from "./typings.js";
import { createPromiseQueue, getFileList } from "../helpers/index.js";
import { checkFile } from "../utils.js";

const decodeText = (text: string): string => {
  const encodedText = text
    .replace(/\\x0d/g, " ")
    .replace(/\\x0a/g, " ")
    .replace(/\\x26/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/ +/g, " ");
  const shouldWrapWithSingleQuote =
    !encodedText.includes("'") && encodedText.includes('"');
  const shouldWrapWithDoubleQuote =
    !shouldWrapWithSingleQuote &&
    (['"', ": "].some((item) => encodedText.includes(item)) ||
      encodedText.startsWith("@"));

  return shouldWrapWithSingleQuote
    ? `'${encodedText}'`
    : shouldWrapWithDoubleQuote
      ? `"${encodedText.replace(/"/g, '\\"')}"`
      : encodedText;
};

export const getAccountListJSON = (
  data: WechatAccountsConfig | QQAccountsConfig,
  location: string,
): WechatAccountsConfig | QQAccountsConfig => {
  data.forEach(({ account }) => {
    account.forEach((item) => {
      checkFile(item.logo, location);
      if ("qrcode" in item) checkFile(item.qrcode, location);
    });
  });

  return data;
};

export const getWechatJSON = (
  data: WechatAccountConfig,
  location: string,
): WechatAccountConfig => {
  checkFile(data.logo, location);

  return data;
};

export const updateAccountFile = (
  folder: string,
  path: string,
): Promise<void> => {
  const filePath = upath.join(folder, path);

  let data = readFileSync(filePath, {
    encoding: "utf-8",
  });

  const results = data
    .split("\n")
    .map((item) => /- url: (.*)$/.exec(item)?.[1] ?? "")
    .filter((item) => item.length);

  return createPromiseQueue(
    results.map(
      (item) => () =>
        fetch(item)
          .then((res) => res.text())
          .then((content) => {
            const supportedOGP = content.includes("<meta property");

            const cover = supportedOGP
              ? /<meta property="og:image" content="(.*?)" \/>/.exec(
                  content,
                )?.[1]
              : /msg_cdn_url = "(.*)"/.exec(content)?.[1];
            const title = supportedOGP
              ? /<meta property="og:title" content="(.*?)" \/>/.exec(
                  content,
                )?.[1]
              : /msg_title = '(.*)'/.exec(content)?.[1];
            const desc = supportedOGP
              ? /<meta property="og:description" content="(.*?)" \/>/.exec(
                  content,
                )?.[1]
              : /msg_desc = htmlDecode\("(.*)"\)/.exec(content)?.[1];

            if (
              typeof cover !== "string" ||
              typeof title !== "string" ||
              typeof desc !== "string"
            ) {
              throw new Error(
                `Parsing failed: ${JSON.stringify({ supportedOGP, cover, title, desc })}`,
              );
            }

            data = data.replace(
              `- url: ${item}`,
              `- cover: ${cover}\n    title: ${decodeText(title)}\n${
                desc ? `    desc: ${decodeText(desc)}\n` : ""
              }    url: ${item}`,
            );
          })
          .then(() => console.log(`${item} fetched`))
          .catch((err) => console.error(`Fetching ${item} failed:`, err)),
    ),
    3,
  ).then(() => {
    writeFileSync(filePath, data, {
      encoding: "utf-8",
    });
  });
};

export const updateAccountFiles = async (folder: string): Promise<void> => {
  const fileList = getFileList(folder, "yml");

  await createPromiseQueue(
    fileList.map(
      (item) => (): Promise<void> => updateAccountFile(folder, item),
    ),
  );
};
