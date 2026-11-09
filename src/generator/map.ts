import { existsSync } from "node:fs";

import { isAbsolute, join, resolve } from "upath";

import { generatorConfig } from "../config.js";
import { withoutAssetFileCheck } from "../helpers/assetCheck.js";
import { ValidationError, formatZodError, runValidation } from "../helpers/validation.js";
import { getPageJSON } from "../page/json.js";
import { checkPageContent } from "../page/schema.js";
import type {
  MapPageConfig,
  MapPageData,
  MarkerConfig,
  MarkerData,
  MarkersConfig,
  MarkersData,
} from "../schema/index.js";
import {
  checkMapPageConfig,
  checkMarkerConfig,
  checkMarkersConfig,
  mapPageDataSchema,
  markersDataSchema,
} from "../schema/index.js";

/** 内置「全部」分类的保留 path */
const ALL_CATEGORY_PATH = "all";

export interface GetMapPageJSONOptions {
  /**
   * 是否进行完整性校验
   *
   * - `true`：校验输入配置、内容组件以及 `$img`/图标等资源文件是否存在。
   * - `false`：跳过输入校验与资源文件存在性检查（用于没有 `img/` 的稀疏检出）， 但仍校验生成数据的形状与类型，避免输出非法数据。
   *
   * @default true
   */
  check?: boolean;
  /**
   * 变更文件列表，用于判断是否需要更新页面 `time` 字段
   *
   * 地图页源文件位于 `mapFolder`，传入的路径需能按 `mapFolder` + `filePath` 归一化后匹配。
   */
  diffFiles?: string[];
}

/**
 * 将路径拆分为片段，统一分隔符并忽略空片段与 `.`
 *
 * @param filePath 待拆分的路径
 * @returns 路径片段
 */
const splitPath = (filePath: string): string[] =>
  filePath.split(/[\\/]/u).filter((segment) => segment && segment !== ".");

/**
 * 计算地图页源 YAML 的候选路径
 *
 * 候选路径来源：
 *
 * - 绝对路径，或相对 cwd 的完整路径；
 * - 去掉 `mapFolder` 末尾与 `filePath` 开头的重叠片段后拼接（如 `mapFolder=data/function/map`、
 *   `filePath=function/map/benbu/building/library`）；
 * - `mapFolder` 与 `filePath` 直接拼接。
 *
 * @param filePath 地图页路径
 * @returns 去重后的候选 YAML 路径
 */
const getMapSourceCandidates = (filePath: string): string[] => {
  const normalizedFilePath = filePath.replaceAll("\\", "/");
  const mapFolderSegments = splitPath(generatorConfig.mapFolder);
  const fileSegments = splitPath(normalizedFilePath);
  const candidates = new Set<string>();

  const addCandidate = (candidate: string): void => {
    candidates.add(candidate.endsWith(".yml") ? candidate : `${candidate}.yml`);
  };

  if (isAbsolute(normalizedFilePath)) addCandidate(normalizedFilePath);
  else addCandidate(resolve(normalizedFilePath));

  // 去掉 mapFolder 末尾与 filePath 开头重叠的片段，例如 mapFolder=data/function/map、
  // filePath=function/map/benbu/building/library
  for (
    let overlap = Math.min(mapFolderSegments.length, fileSegments.length);
    overlap >= 0;
    overlap -= 1
  ) {
    const mapTail = mapFolderSegments.slice(mapFolderSegments.length - overlap);
    const fileHead = fileSegments.slice(0, overlap);

    if (!mapTail.every((segment, index) => segment === fileHead[index])) continue;

    const rest = fileSegments.slice(overlap);

    if (rest.length) addCandidate(join(generatorConfig.mapFolder, ...rest));

    break;
  }

  if (!isAbsolute(normalizedFilePath))
    addCandidate(join(generatorConfig.mapFolder, normalizedFilePath));

  return [...candidates];
};

/**
 * 查找地图页对应的源 YAML
 *
 * 优先使用 `mapFolder` 下的真实文件；未找到时回退到旧版 `pageFolder` 布局，保持向后兼容。
 *
 * 文件不存在时返回 undefined，调用方不得据此写入或抛错。
 *
 * @param filePath 地图页路径
 * @param diffFiles 变更文件列表
 * @returns 存在的源 YAML 路径，未找到时为 undefined
 */
const findMapSourcePath = (filePath: string, diffFiles: string[]): string | undefined => {
  const candidates = getMapSourceCandidates(filePath).filter((candidate) => existsSync(candidate));

  if (!candidates.length) {
    const legacyPath = join(generatorConfig.pageFolder, `${filePath}.yml`);

    if (existsSync(legacyPath)) return legacyPath;

    // oxlint-disable-next-line eslint/no-undefined -- 未找到源文件时用 undefined 表示不更新时间
    return undefined;
  }

  if (candidates.length === 1) return candidates[0];

  const changedFiles = new Set(diffFiles.map((changedFilePath) => resolve(changedFilePath)));

  return candidates.find((candidate) => changedFiles.has(resolve(candidate))) ?? candidates[0];
};

/**
 * 处理地图页面数据
 *
 * @param data 地图页面配置
 * @param filePath 文件路径
 * @param options 处理选项
 * @returns 处理后的地图页面数据
 */
export const getMapPageJSON = (
  data: MapPageConfig,
  filePath: string,
  { check = true, diffFiles = [] }: GetMapPageJSONOptions = {},
): MapPageData => {
  if (check) {
    runValidation(`${filePath} 地图页面校验失败`, () => {
      const issues = [
        // 地图页带 photo 字段，用含 photo 的 mapPageConfigSchema 校验配置（形状 + 内容组件）
        ...checkMapPageConfig(data, filePath),
        // 内容组件的手动校验（list/grid 路径存在性等）
        ...checkPageContent(data.content, filePath, filePath),
      ];

      if (issues.length) throw new ValidationError(`${filePath} 地图页面校验失败`, issues);
    });
  }

  // 地图 YAML 位于 mapFolder，而不是 pageFolder；未找到真实源文件时不更新时间，避免误抛
  const sourcePath = findMapSourcePath(filePath, diffFiles);

  // 输入校验已由上方完成，getPageJSON 内不再重复检查，仅做纯转换
  const pageData: MapPageData = getPageJSON(data, filePath, sourcePath ? diffFiles : [], {
    check: false,
    sourcePath,
  });

  if (data.photo) pageData.photo = data.photo;

  // 输出兜底：即使 check=false，也不允许产出不符合 mapPageDataSchema 的数据；
  // 稀疏检出下没有 img/ 等资源目录，只校验形状/类型，跳过 existsSync
  const parsed = check
    ? mapPageDataSchema.safeParse(pageData)
    : withoutAssetFileCheck(() => mapPageDataSchema.safeParse(pageData));

  if (!parsed.success) {
    throw new ValidationError(`${filePath} 地图页面数据校验失败`, [
      `生成的地图页数据不符合 mapPageDataSchema:\n${formatZodError(parsed.error)}`,
    ]);
  }

  return parsed.data;
};

/**
 * 收集单个标记点的校验问题
 *
 * 除标记点结构外，还检查其介绍页是否真实存在。
 *
 * @param marker 待处理的 Marker
 * @param folder Marker 所在的文件夹
 * @param category Marker 所属的分类
 * @returns 校验问题列表
 */
const checkMarker = (marker: MarkerConfig, folder: string, category: string): string[] => {
  const issues = checkMarkerConfig(marker, `${folder}/${category}`);

  if (marker.path) {
    const path = join(category, marker.path);
    const filePath = join(generatorConfig.mapFolder, folder, category, `${marker.path}.yml`);

    if (!existsSync(filePath)) {
      const message = `路径 ${filePath} 在 ${path} 中不存在!`;

      console.error(message);
      issues.push(message);
    }
  }

  return issues;
};

/**
 * 处理 marker
 *
 * @param marker 待处理的 Marker
 * @param folder Marker 所在的文件夹
 * @param category Marker 所属的分类
 * @param options 处理选项
 * @returns 处理后的 marker
 */
export const getMarkerJSON = (
  marker: MarkerConfig,
  folder: string,
  category: string,
  { id = 1, check = true }: { id?: number; check?: boolean } = {},
): MarkerData => {
  if (check) {
    const issues = checkMarker(marker, folder, category);

    if (issues.length)
      throw new ValidationError(`${folder}/${category} 地图标记点校验失败`, issues);
  }

  const markerData = {
    id,
    ...marker,
  };

  if (marker.path) markerData.path = join(category, marker.path);

  return markerData;
};

/**
 * 处理标记点数据
 *
 * @param data 标记点配置
 * @param folder 标记点所在的文件夹
 * @param options 处理选项
 * @returns 处理后的标记点数据
 */
export const getMarkersJSON = (
  data: MarkersConfig,
  folder: string,
  { check = true }: { check?: boolean } = {},
): MarkersData => {
  if (check) {
    const issues = checkMarkersConfig(data, folder);

    if (issues.length) throw new ValidationError(`${folder} 地图标记点校验失败`, issues);
  }

  const categories = Object.keys(data);

  // "all" 是内置「全部」分类的保留 path：用户分类与之同名时，
  // markers.all 会被重复累积，分类列表也会出现重复项
  if (categories.includes(ALL_CATEGORY_PATH)) {
    throw new Error(
      `地图标记点分类 path "${ALL_CATEGORY_PATH}" 为保留名（内置「全部」分类），` +
        `请重命名该分类后再生成${folder ? `，位置: ${folder}` : ""}`,
    );
  }

  const categoryConfig = [
    { path: ALL_CATEGORY_PATH, name: "全部" },
    ...categories.map((category) => ({
      path: category,
      name: data[category].name,
    })),
  ];

  // marker id 从 1 开始分配（markerDataSchema 要求 id 为正整数）
  let id = 1;
  const markers = { [ALL_CATEGORY_PATH]: [] } as Record<string, MarkerData[]>;

  // 单个 marker 的校验问题先收集，全部处理完再统一抛出，避免只报告第一个问题
  const markerIssues: string[] = [];

  categories.forEach((category) => {
    markers[category] = data[category].content.map((marker) => {
      const markerId = id;

      id += 1;

      // getMarkerJSON 此处只做纯转换，结构校验与介绍页存在性检查统一在上方收集
      if (check) markerIssues.push(...checkMarker(marker, folder, category));

      return getMarkerJSON(marker, folder, category, { id: markerId, check: false });
    });

    markers[ALL_CATEGORY_PATH] = [...markers[ALL_CATEGORY_PATH], ...markers[category]];
  });

  if (markerIssues.length)
    throw new ValidationError(`${folder} 地图标记点校验失败`, [...new Set(markerIssues)]);

  const result = { category: categoryConfig, marker: markers };
  const parsed = markersDataSchema.safeParse(result);

  // 生成结果必须满足自家 schema，避免输出非法数据
  if (!parsed.success) {
    throw new Error(
      `生成的地图标记点数据不符合 markersDataSchema:\n${formatZodError(parsed.error)}`,
    );
  }

  return parsed.data;
};
