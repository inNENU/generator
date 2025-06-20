import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { load } from "js-yaml";
import upath from "upath";

import type { YamlMapItem } from "./helpers/index.js";
import { getFileList, getYamlMap } from "./helpers/index.js";
import { getPageText } from "./text.js";
import type { PageConfig } from "./typings.js";

/** @deprecated */
export interface DeprecatedGenerateKnowledgeOptions {
  /**
   * 最小长度
   *
   * @default 100
   */
  minLength?: number;

  /**
   * 最大长度
   *
   * @default 1000
   */
  maxLength?: number;

  /**
   * 是否合并跨目录
   *
   * @default false
   */
  mergeCrossDir?: boolean;
}

/** @deprecated */
export const generateKnowledgeBaseDirItems = (
  items: YamlMapItem<string>[],
  destination: string,
  {
    minLength = 100,
    maxLength = 1000,
    mergeCrossDir = false,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
  }: DeprecatedGenerateKnowledgeOptions = {},
): string | void => {
  if (!existsSync(destination)) mkdirSync(destination, { recursive: true });
  const dirname = upath.basename(destination);

  const content = items
    .map((item) => {
      // convert nested directory
      if (item.type === "dir") {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const content = generateKnowledgeBaseDirItems(
          item.content,
          upath.join(destination, item.dirname),
        );

        if (content) {
          return {
            filename: item.dirname,
            value: content,
            length: item.content.length,
          };
        }

        return null;
      }

      return {
        filename: item.filename,
        value: item.value,
        length: item.value.length,
      };
    })
    .filter((item) => item !== null);

  let homeItemContent =
    content.find((item) => item?.filename === "index.yml")?.value ?? "";
  let index = 0;

  content
    .filter((item) => {
      if (item.length > maxLength) {
        writeFileSync(
          upath.join(destination, item.filename.replace(/\.yml$/u, ".md")),
          item.value,
          { encoding: "utf-8" },
        );

        return false;
      }

      if (item.length < minLength) {
        if (item.length + homeItemContent.length > maxLength) {
          writeFileSync(
            upath.join(
              destination,
              `${dirname}-README${index === 0 ? "" : index}.md`,
            ),
            item.value,
            { encoding: "utf-8" },
          );

          homeItemContent = item.value;
          index++;
        }

        homeItemContent += `\n\n${item.value}`;

        return false;
      }

      return true;
    })
    .forEach((item) => {
      if (homeItemContent.length + item.value.length < maxLength) {
        homeItemContent += `\n\n${item.value}`;
      } else {
        writeFileSync(
          upath.join(destination, item.filename.replace(/\.yml$/u, ".md")),
          item.value,
          { encoding: "utf-8" },
        );
      }
    });

  if (!mergeCrossDir && homeItemContent.length) {
    writeFileSync(
      upath.join(
        destination,
        `${dirname}-README${index === 0 ? "" : index}.md`,
      ),
      homeItemContent,
      { encoding: "utf-8" },
    );
  } else if (homeItemContent.length > minLength) {
    writeFileSync(
      upath.join(
        destination,
        `${dirname}-README${index === 0 ? "" : index}.md`,
      ),
      homeItemContent,
      { encoding: "utf-8" },
    );
  } else {
    return homeItemContent;
  }
};

/**
 * @deprecated
 */
export const generateKnowledgeBase = (
  folder: string,
  distFolder: string,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  options?: DeprecatedGenerateKnowledgeOptions,
): void => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const generateDirItemsResult = generateKnowledgeBaseDirItems(
    getYamlMap<PageConfig, string>(folder, getPageText),
    distFolder,
    options,
  );

  if (generateDirItemsResult) {
    writeFileSync(
      upath.join(distFolder, `${upath.dirname(distFolder)}-README.md`),
      generateDirItemsResult,
      { encoding: "utf-8" },
    );
  }
};

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

    const targetFilename = filePath
      .replace(/\//g, "-")
      .replace(/\.yml$/u, ".md")
      .replace(/(\/|^)index.md$/, "$1README.md");

    const content = readFileSync(sourceFilename, { encoding: "utf-8" });

    const data = load(content) as PageConfig;

    if (data.aiIgnore || !data.tags?.length) return;

    const text = getPageText(data, filePathRelative);

    data.tags.forEach((tag) => {
      const targetFolderPath = upath.resolve(distFolder, tag);

      if (!existsSync(targetFolderPath))
        mkdirSync(targetFolderPath, { recursive: true });

      const targetFilePath = upath.join(targetFolderPath, targetFilename);

      writeFileSync(targetFilePath, text, { encoding: "utf-8" });
    });
  });
};
