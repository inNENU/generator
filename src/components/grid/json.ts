import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";

import type { GridComponentOptions } from "./typings.js";
import { checkIcon, resolvePath } from "../../utils.js";

export const getGridJSON = (
  grid: GridComponentOptions,
  pageId: string,
  location = "",
): GridComponentOptions => {
  if (Array.isArray(grid.items))
    grid.items.forEach((gridItem) => {
      // 处理路径
      if ("path" in gridItem && !("appId" in gridItem))
        if (gridItem.path.startsWith("/")) {
          const path = resolvePath(gridItem.path);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`Path ${path} not exists in ${location}`);

          gridItem.path = path;
        } else {
          const paths = pageId.split("/");

          paths.pop();

          const path = resolvePath(`${paths.join("/")}/${gridItem.path}`);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`Path ${path} not exists in ${location}`);

          gridItem.path = path;
        }

      checkIcon(gridItem.icon, location);

      checkKeys(
        gridItem,
        {
          text: "string",
          icon: "string",
          base64Icon: ["string", "undefined"],
          path: ["string", "undefined"],
          url: ["string", "undefined"],
          appId: ["string", "undefined"],
          extraData: ["Record<string, any>", "undefined"],
          versionType: {
            type: ["string", "undefined"],
            enum: ["develop", "trial", "release", undefined],
          },
          env: ["string[]", "undefined"],
        },
        `${location}.content`,
      );
    });

  checkKeys(
    grid,
    {
      tag: "string",
      header: { type: ["string", "undefined"], additional: [false] },
      items: "array",
      footer: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return grid;
};
