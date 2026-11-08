import { existsSync } from "node:fs";

import { join } from "upath";

import { generatorConfig } from "../config.js";
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
  markersDataSchema,
} from "../schema/index.js";

/** 内置「全部」分类的保留 path */
const ALL_CATEGORY_PATH = "all";

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
  { check = true }: { check?: boolean } = {},
): MapPageData => {
  if (check) {
    // 地图页带 photo 字段，用含 photo 的 mapPageConfigSchema 校验配置（形状 + 内容组件 + 资产可达性）
    checkMapPageConfig(data, filePath);
    // 内容组件的手动校验（list/grid 路径存在性等）
    checkPageContent(data.content, filePath, filePath);
  }

  // 校验已由上方完成，getPageJSON 内不再重复检查，仅做纯转换
  return getPageJSON(data, filePath, [], { check: false });
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
  if (check) checkMarkerConfig(marker);

  const markerData = {
    id,
    ...marker,
  };

  if (marker.path) {
    const path = join(category, marker.path);
    const filePath = join(generatorConfig.mapFolder, folder, category, `${marker.path}.yml`);

    if (check && !existsSync(filePath)) console.error(`路径 ${filePath} 在 ${path} 中不存在!`);

    markerData.path = path;
  }

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
  if (check) checkMarkersConfig(data, folder);

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

  categories.forEach((category) => {
    markers[category] = data[category].content.map((marker) => {
      const markerId = id;

      id += 1;

      return getMarkerJSON(marker, folder, category, { id: markerId, check });
    });

    markers[ALL_CATEGORY_PATH] = [...markers[ALL_CATEGORY_PATH], ...markers[category]];
  });

  const result = { category: categoryConfig, marker: markers };
  const parsed = markersDataSchema.safeParse(result);

  // 生成结果必须满足自家 schema，避免输出非法数据
  if (!parsed.success) {
    throw new Error(
      `生成的地图标记点数据不符合 markersDataSchema: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return parsed.data;
};
