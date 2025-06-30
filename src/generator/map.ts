import { existsSync } from "node:fs";

import upath from "upath";

import { _config } from "../config.js";
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

export const getMapPageJSON = (
  data: MapPageConfig,
  filePath: string,
): MapPageData => {
  checkMapPageConfig(data, filePath);

  return getPageJSON(data, filePath);
};

/**
 * 处理 marker
 *
 * @param marker 待处理的 Marker
 *
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
    const path = upath.join(category, marker.path);
    const filePath = upath.join(
      _config.mapFolder,
      folder,
      category,
      `${marker.path}.yml`,
    );

    if (!existsSync(filePath))
      console.error(`路径 ${filePath} 在 ${path} 中不存在!`);

    markerData.path = path;
  }

  return markerData;
};

export const getMarkersJSON = (
  data: MarkersConfig,
  folder: string,
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
    markers[category] = data[category].content.map((marker) =>
      getMarkerJSON(marker, folder, category, id++),
    );

    markers.all = markers.all.concat(markers[category]);
  });

  return { category: categoryConfig, marker: markers };
};
