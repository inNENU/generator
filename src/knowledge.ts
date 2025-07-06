import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { load } from "js-yaml";
import upath from "upath";

import { getFileList } from "./helpers/index.js";
import { getPageText } from "./page/text.js";
import type { PageConfig } from "./typings.js";

export const generateKnowledgeContent = (
  sourceFolder: string,
  distFolder: string,
): void => {
  if (!existsSync(distFolder)) mkdirSync(distFolder, { recursive: true });

  const fileList = getFileList(sourceFolder, "yml");

  fileList.forEach((filePath) => {
    const filePathRelative = upath.relative(
      "./",
      filePath.replace(/\.yml$/u, ""),
    );
    const sourceFilename = upath.resolve(sourceFolder, filePath);

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const data = load(content) as PageConfig;

    if (data.aiIgnore) return;

    const text = getPageText(data, filePathRelative);

    const targetFilename = upath.resolve(
      distFolder,
      filePath
        .replace(/\.yml$/u, ".md")
        .replace(/(\/|^)index.md$/, "$1README.md"),
    );
    const targetDirname = upath.dirname(targetFilename);

    if (!existsSync(targetDirname))
      mkdirSync(targetDirname, { recursive: true });

    writeFileSync(targetFilename, text, { encoding: "utf-8" });
  });
};
