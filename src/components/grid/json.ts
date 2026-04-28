import { existsSync } from "node:fs";

import { resolvePath } from "../../utils.js";
import type { GridComponentOptions } from "./schema.js";

export const getGridJSON = (
  grid: GridComponentOptions,
  pageId: string,
  location = "",
): GridComponentOptions => {
  if (Array.isArray(grid.items)) {
    grid.items.forEach((gridItem) => {
      // 处理路径
      if ("path" in gridItem && !("appId" in gridItem)) {
        let path: string;

        if (gridItem.path.startsWith("/")) {
          path = resolvePath(gridItem.path);
        } else {
          const paths = pageId.split("/");

          paths.pop();

          path = resolvePath(`${paths.join("/")}/${gridItem.path}`);
        }

        if (!existsSync(`./pages/${path}.yml`))
          console.error(`路径 ${path} 在 ${location} 中不存在`);

        gridItem.path = path;
      }
    });
  }

  return grid;
};
