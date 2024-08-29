import type { LocationComponentOptions } from "./typings.js";
import { _config } from "../../config.js";

export const getLocationMarkdown = ({
  title,
  points = [],
}: LocationComponentOptions): string =>
  `\
${
  title
    ? `\
#### ${title}

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
