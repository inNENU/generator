import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { resolve } from "upath";

import { convertSVGToDataURI, getFileList } from "../helpers/index.js";

// 无原型对象：`__proto__`、`constructor`、`toString` 都是合法的分类名/图标名，
// 普通对象字面量会把它们写到原型链上（静默丢数据甚至污染全局原型）。
const createIconRecord = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

/**
 * 生成 SVG 图标文件
 *
 * 输出文件名保持与源文件一致（不含 `.svg` 扩展名，供小程序 `readFile("icon/<名称>")` 直接使用）： 根目录图标写成 data URI 文件，一级子目录聚合成同名
 * JSON（`{ 图标名: data URI }`）。同一分类内的多个图标是合法布局，会聚合到同一个 JSON。
 *
 * 生成前会先校验布局，遇到无法安全表达的输入（超过一级的嵌套、根图标与分类同名、大小写不敏感的文件系统上重名）直接抛错，避免静默覆盖。
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

  interface OutputEntry {
    /** 输出名（根图标文件名或分类 JSON 文件名） */
    name: string;
    /** 是否来自分类目录 */
    isCategory: boolean;
    /** 来源文件（用于冲突报错） */
    filePath: string;
  }

  // 根图标文件与分类 JSON 写入同一目录，共享大小写不敏感的命名空间。
  // 同一分类目录内的多个图标会聚合进同一个 JSON（键为图标名），只需登记一次分类输出名。
  const outputNames = new Map<string, OutputEntry>();

  entries.forEach((entry) => {
    const name = entry.category ?? entry.name;
    const key = name.toLowerCase();
    const existing = outputNames.get(key);
    const isCategory = typeof entry.category === "string";

    if (existing) {
      // 同一分类内的图标是合法的聚合输出，不构成冲突。
      if (existing.isCategory && existing.name === entry.category) return;

      throw new Error(
        `图标输出名冲突: "${name}" 同时来自 ${existing.filePath} 与 ${entry.filePath}`,
      );
    }

    outputNames.set(key, { name, isCategory, filePath: entry.filePath });
  });

  if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true });

  const iconStore = createIconRecord<Record<string, string>>();

  entries.forEach(({ filePath, category, name }) => {
    const sourceFilename = resolve(sourceFolder, filePath);
    const svgContent = readFileSync(sourceFilename, { encoding: "utf-8" });
    const dataUri = convertSVGToDataURI(svgContent);

    if (category) {
      const categoryIcons = iconStore[category] ?? createIconRecord<string>();

      iconStore[category] = categoryIcons;
      categoryIcons[name] = dataUri;

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
