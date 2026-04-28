import { existsSync } from "node:fs";

import { join } from "upath";

import { generatorConfig } from "../../config.js";
import { resolvePath } from "../../utils.js";
import type { LocationComponentOptions } from "./schema.js";

export const getLocationJSON = (
  component: LocationComponentOptions,
  location = "",
): LocationComponentOptions => {
  component.points.forEach((item) => {
    if (item.path) {
      const path = resolvePath(item.path);

      if (!existsSync(join(generatorConfig.mapFolder, `${path}.yml`)))
        console.error(`路径 ${path} 在 ${location} 中不存在`);
    }
  });

  return component;
};
