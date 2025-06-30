import { existsSync } from "node:fs";

import upath from "upath";

import type { LocationComponentOptions } from "./schema.js";
import { checkLocation } from "./schema.js";
import { _config } from "../../config.js";
import { resolvePath } from "../../utils.js";

export const getLocationJSON = (
  component: LocationComponentOptions,
  location = "",
): LocationComponentOptions => {
  checkLocation(component, location);

  component.points.forEach((item) => {
    if (item.path) {
      const path = resolvePath(item.path);

      if (!existsSync(upath.join(_config.mapFolder, `${path}.yml`)))
        console.error(`路径 ${path} 在 ${location} 中不存在`);
    }
  });

  return component;
};
