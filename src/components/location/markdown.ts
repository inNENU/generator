import { generatorConfig } from "../../config.js";
import { escapeHtml } from "../../utils.js";
import type { LocationComponentOptions } from "./schema.js";
import { checkLocation } from "./schema.js";

/**
 * 生成腾讯地图标记链接
 *
 * @param points 位置点信息
 * @returns 地图标记链接
 */
export const getLocationMarkerUrl = (points: LocationComponentOptions["points"]): string =>
  `https://apis.map.qq.com/tools/poimarker?type=0&marker=${points
    // 最多 4 个点
    .slice(0, 4)
    .map(
      ({ loc, name = "位置", detail = "详情" }) =>
        `coord:${loc};title:${encodeURIComponent(name)};addr:${encodeURIComponent(detail)}`,
    )
    .join("|")}&key=${generatorConfig.mapKey}&referer=inNENU`;

export const getLocationMarkdown = (
  location: LocationComponentOptions,
  locationParam = "",
): string => {
  if (location.env && !location.env.includes("web")) return "";

  checkLocation(location, locationParam);

  const { header, points } = location;

  if (points.length > 4) {
    console.warn(
      `地点组件网页版地图最多展示 4 个位置点，已忽略 ${points.length - 4} 个（JSON 与小程序仍使用全部点）${
        locationParam ? `（位置: ${locationParam}）` : ""
      }`,
    );
  }

  return `\
${
  header
    ? `\
#### ${escapeHtml(header)}

`
    : ""
}\
<iframe class="location-iframe" src="${escapeHtml(getLocationMarkerUrl(points))}" frameborder="0" width="100%" height="320px" />

`;
};
