import { join } from "upath";

import { generatorConfig } from "../../config.js";
import { findYamlFile } from "../../helpers/yamlPath.js";
import { resolvePath } from "../../utils.js";
import type { LocationComponentOptions } from "./schema.js";

export const getLocationJSON = (
  component: LocationComponentOptions,
  location = "",
): LocationComponentOptions => {
  component.points.forEach((item) => {
    if (item.path) {
      const path = resolvePath(item.path);

      if (!findYamlFile(join(generatorConfig.mapFolder, path)))
        console.error(`路径 ${path} 在 ${location} 中不存在`);
    }
  });

  return component;
};
