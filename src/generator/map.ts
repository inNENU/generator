import { existsSync } from "node:fs";

import { join } from "upath";

import { generatorConfig } from "../config.js";
import { getPageJSON } from "../page/json.js";
import type {
  MapPageConfig,
  MapPageData,
  MarkerConfig,
  MarkerData,
  MarkersConfig,
  MarkersData,
} from "../schema/index.js";
import { checkMapPageConfig, checkMarkerConfig } from "../schema/index.js";

/**
 * 处理地图页面数据
 *
 * @param data 地图页面配置
 * @param filePath 文件路径
 * @returns 处理后的地图页面数据
 */
export const getMapPageJSON = (data: MapPageConfig, filePath: string): MapPageData => {
  checkMapPageConfig(data, filePath);

  // checkMapPageConfig 已使用含 photo 字段的 mapPageConfigSchema 校验过配置，
  // 因此跳过 getPageJSON 内部用不含 photo 的 pageConfigSchema 的重复校验（check: false），
  // 但仍保留 checkPageContent 组件级校验（含 list/grid 路径存在性检查）
  return getPageJSON(data, filePath, [], { check: false, checkContent: true });
};

/**
 * 处理 marker
 *
 * @param marker 待处理的 Marker
 * @param folder Marker 所在的文件夹
 * @param category Marker 所属的分类
 * @param id Marker 的 ID
 * @returns 处理后的marker
 */
export const getMarkerJSON = (
  marker: MarkerConfig,
  folder: string,
  category: string,
  id: number,
): MarkerData => {
  checkMarkerConfig(marker);

  const markerData = {
    id,
    ...marker,
  };

  if (marker.path) {
    const path = join(category, marker.path);
    const filePath = join(generatorConfig.mapFolder, folder, category, `${marker.path}.yml`);

    if (!existsSync(filePath)) console.error(`路径 ${filePath} 在 ${path} 中不存在!`);

    markerData.path = path;
  }

  return markerData;
};

/**
 * 处理标记点数据
 *
 * @param data 标记点配置
 * @param folder 标记点所在的文件夹
 * @returns 处理后的标记点数据
 */
export const getMarkersJSON = (data: MarkersConfig, folder: string): MarkersData => {
  const categories = Object.keys(data);

  const categoryConfig = [
    { path: "all", name: "全部" },
    ...categories.map((category) => ({
      path: category,
      name: data[category].name,
    })),
  ];

  let id = 0;
  const markers = { all: [] } as Record<string, MarkerData[]>;

  categories.forEach((category) => {
    markers[category] = data[category].content.map((marker) => {
      const markerId = id;

      id += 1;

      return getMarkerJSON(marker, folder, category, markerId);
    });

    markers.all = [...markers.all, ...markers[category]];
  });

  return { category: categoryConfig, marker: markers };
};
