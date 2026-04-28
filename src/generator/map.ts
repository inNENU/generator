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

export const getMapPageJSON = (data: MapPageConfig, filePath: string): MapPageData => {
  checkMapPageConfig(data, filePath);

  return getPageJSON(data, filePath);
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
