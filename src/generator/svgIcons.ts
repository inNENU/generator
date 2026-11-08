import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { resolve } from "upath";

import { convertSVGToDataURI, getFileList } from "../helpers/index.js";

/**
 * 生成 SVG 图标文件
 *
 * 输出文件名保持与源文件一致（不含 `.svg` 扩展名，供小程序 `readFile("icon/<名称>")` 直接使用）： 根目录图标写成 data URI 文件，一级子目录聚合成同名
 * JSON（`{ 图标名: data URI }`）。生成前会先校验布局，遇到无法安全表达的输入（超过一级的嵌套、根图标与分类同名、 大小写不敏感的文件系统上重名）直接抛错，避免静默覆盖。
 *
 * @param sourceFolder 源文件夹
 * @param targetFolder 目标文件夹
 */
export const generateSvgIcons = (sourceFolder: string, targetFolder: string): void => {
  const fileList = getFileList(sourceFolder, "svg");

  interface IconEntry {
    /** 源文件（相对 sourceFolder） */
    filePath: string;
    /** 分类目录，根图标为 undefined */
    category?: string;
    /** 输出名（不含扩展名） */
    name: string;
  }

  const entries: IconEntry[] = fileList.map((filePath) => {
    const parts = filePath.split("/");

    if (parts.length > 2)
      throw new Error(`不支持深层嵌套图标生成: ${filePath}（最多支持一层分类目录）`);

    const svgName = parts.at(-1) ?? "";
    const name = svgName.replace(/\.svg$/u, "");

    return parts.length === 2 ? { filePath, category: parts[0], name } : { filePath, name };
  });

  // 输出名共享同一命名空间（根图标文件与分类 JSON 文件同目录），大小写不敏感的文件系统上还会互相覆盖。
  const outputNames = new Map<string, IconEntry>();

  entries.forEach((entry) => {
    const outputName = entry.category ?? entry.name;
    const key = outputName.toLowerCase();
    const existing = outputNames.get(key);

    if (existing) {
      throw new Error(
        `图标输出名冲突: "${outputName}" 同时来自 ${existing.filePath} 与 ${entry.filePath}`,
      );
    }

    outputNames.set(key, entry);
  });

  if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true });

  const iconStore: Record<string, Record<string, string>> = {};

  entries.forEach(({ filePath, category, name }) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const svgContent = readFileSync(sourceFilename, { encoding: "utf-8" });
    const dataUri = convertSVGToDataURI(svgContent);

    if (category) {
      iconStore[category] ??= {};
      iconStore[category][name] = dataUri;

      return;
    }

    writeFileSync(resolve(targetFolder, name), dataUri, { encoding: "utf-8" });
  });

  Object.entries(iconStore).forEach(([category, icons]) => {
    writeFileSync(resolve(targetFolder, category), JSON.stringify(icons), {
      encoding: "utf-8",
    });
  });
};
