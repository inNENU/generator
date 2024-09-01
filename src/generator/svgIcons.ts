import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import upath from "upath";

import { convertSVGToBase64DataURI, getFileList } from "../helpers/index.js";

export const generateSvgIcons = (
  sourceFolder: string,
  targetFolder: string,
): void => {
  const fileList = getFileList(sourceFolder, "svg");

  const iconStore: Record<string, Record<string, string>> = {};

  if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true });

  fileList.forEach((filePath) => {
    const results = filePath.split("/");

    if (results.length > 2) {
      console.error("Deep nested icon generation is not supported!");
    }

    const sourceFilename = upath.resolve(sourceFolder, filePath);
    const svgContent = readFileSync(sourceFilename, {
      encoding: "utf-8",
    });

    if (results.length === 2) {
      const [category, icon] = results;
      const iconName = icon.replace(/\.svg$/u, "");

      iconStore[category] ??= {};

      iconStore[category][iconName] = convertSVGToBase64DataURI(svgContent);
    } else {
      const targetFilename = upath.resolve(
        targetFolder,
        filePath.replace(/\.svg$/u, ""),
      );

      writeFileSync(targetFilename, convertSVGToBase64DataURI(svgContent), {
        encoding: "utf-8",
      });
    }
  });

  Object.entries(iconStore).forEach(([category, icons]) => {
    const categoryFilename = upath.resolve(targetFolder, category);

    writeFileSync(categoryFilename, JSON.stringify(icons), {
      encoding: "utf-8",
    });
  });
};
