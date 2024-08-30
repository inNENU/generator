import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";
import upath from "upath";

import type { LocationComponentOptions } from "./typings.js";
import { _config } from "../../config.js";
import { resolvePath } from "../../utils.js";

export const getLocationJSON = (
  component: LocationComponentOptions,
  location = "",
): LocationComponentOptions => {
  checkKeys(
    component,
    {
      tag: "string",
      header: "string",
      points: "object[]",
      navigate: ["boolean", "undefined"],
    },
    location,
  );

  component.points.forEach((item) => {
    checkKeys(item, {
      loc: "string",
      name: ["string", "undefined"],
      detail: ["string", "undefined"],
      path: ["string", "undefined"],
    });

    if (item.path) {
      const path = resolvePath(item.path);

      if (!existsSync(upath.join(_config.mapFolder, `${path}.yml`)))
        console.error(`Path ${path} not exists in ${location}`);
    }
  });

  return component;
};
