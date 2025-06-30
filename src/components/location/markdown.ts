import type { LocationComponentOptions } from "./schema.js";
import { checkLocation } from "./schema.js";
import { _config } from "../../config.js";

export const getLocationMarkdown = (
  location: LocationComponentOptions,
): string => {
  if (location.env && !location.env.includes("web")) return "";

  checkLocation(location);

  const { header, points = [] } = location;

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
        `coord:${loc};title:${encodeURIComponent(
          name,
        )};addr:${encodeURIComponent(detail)}`,
    )
    .join(
      "|",
    )}&key=${_config.mapKey}&referer=inNENU" frameborder="0" width="100%" height="320px" />

`;
};
