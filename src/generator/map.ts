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
import { checkMapPageConfig, checkMarkerConfig } from "../schema/index.js";

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
  { id = 0, check = true }: { id?: number; check?: boolean } = {},
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

      return getMarkerJSON(marker, folder, category, { id: markerId, check });
    });

    markers.all = [...markers.all, ...markers[category]];
  });

  return { category: categoryConfig, marker: markers };
};
