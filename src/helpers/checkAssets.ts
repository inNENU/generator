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
      .map((folder) =>
        getFileList(folder).map((path) => upath.join(folder, path)),
      )
      .flat()
      .filter((link) =>
        ignoreRules.every((rule) =>
          rule instanceof RegExp ? !rule.test(link) : rule !== link,
        ),
      ),
  );

  const assetRegExp = new RegExp(
    `\\$((?:${assetFolders.join("|")})/.*)$`,
    "gm",
  );

  pageFolders
    .map((folder) =>
      getFileList(folder, "yml").map((path) => upath.join(folder, path)),
    )
    .flat()
    .forEach((path) => {
      Array.from(
        readFileSync(path, { encoding: "utf-8" }).matchAll(assetRegExp),
      ).forEach(([, link]) => {
        assets.delete(link);
      });
    });

  console.log("未使用的资源:\n", Array.from(assets).join("\n"));
};
