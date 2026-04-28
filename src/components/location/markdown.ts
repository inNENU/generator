import { generatorConfig } from "../../config.js";
import type { LocationComponentOptions } from "./schema.js";
import { checkLocation } from "./schema.js";

export const getLocationMarkdown = (
  location: LocationComponentOptions,
  locationParam = "",
): string => {
  if (location.env && !location.env.includes("web")) return "";

  checkLocation(location, locationParam);

  const { header, points } = location;

  return `\
${
  header
    ? `\
#### ${header}

`
    : ""
}\
<iframe class="location-iframe" src="https://apis.map.qq.com/tools/poimarker?type=0&marker=${points
    // maximum 4 points
    .slice(0, 4)
    .map(
      ({ loc, name = "位置", detail = "详情" }) =>
        `coord:${loc};title:${encodeURIComponent(name)};addr:${encodeURIComponent(detail)}`,
    )
    .join(
      "|",
    )}&key=${generatorConfig.mapKey}&referer=inNENU" frameborder="0" width="100%" height="320px" />

`;
};
