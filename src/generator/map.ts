import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";
import upath from "upath";

import type {
  MapPageConfig,
  MapPageData,
  MarkerConfig,
  MarkerData,
  MarkersConfig,
  MarkersData,
} from "./typings.js";
import { _config } from "../config.js";
import { resolvePage } from "../page.js";
import { checkFile } from "../utils.js";

export const generateMapPageJSON = (
  data: MapPageConfig,
  filePath: string,
): MapPageData => {
  checkKeys(data, {
    photo: ["string[]", "undefined"],
  });

  if (Array.isArray(data.photo))
    data.photo?.map((link, index) =>
      // `$` alias resolve and file check
      checkFile(link, `${filePath}.photos[${index}]`),
    );

  return resolvePage(data, filePath);
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
      console.error(`${filePath} as ${path} not exists!`);

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
