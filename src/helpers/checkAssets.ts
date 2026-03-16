import { readFileSync } from "node:fs";

import upath from "upath";

import { getFileList } from "./getFileList.js";

export const checkAssets = (
  pageFolders: string[],
  assetFolders: string[],
  ignoreRules: (string | RegExp)[] = [],
): void => {
  const assets = new Set(
    assetFolders
      .flatMap((folder) => getFileList(folder).map((path) => upath.join(folder, path)))
      .filter((link) =>
        ignoreRules.every((rule) => (rule instanceof RegExp ? !rule.test(link) : rule !== link)),
      ),
  );

  const assetRegExp = new RegExp(`\\$((?:${assetFolders.join("|")})/.*)$`, "gm");

  pageFolders
    .flatMap((folder) => getFileList(folder, "yml").map((path) => upath.join(folder, path)))
    .forEach((path) => {
      [...readFileSync(path, { encoding: "utf-8" }).matchAll(assetRegExp)].forEach(
        ([, assetLink]) => {
          assets.delete(assetLink);
        },
      );
    });

  console.log("未使用的资源:\n", [...assets].join("\n"));
};
