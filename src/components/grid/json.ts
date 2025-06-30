import { existsSync } from "node:fs";

import type { GridComponentOptions } from "./schema.js";
import { checkGrid } from "./schema.js";
import { resolvePath } from "../../utils.js";

export const getGridJSON = (
  grid: GridComponentOptions,
  pageId: string,
  location = "",
): GridComponentOptions => {
  checkGrid(grid, location);

  if (Array.isArray(grid.items))
    grid.items.forEach((gridItem) => {
      // 处理路径
      if ("path" in gridItem && !("appId" in gridItem))
        if (gridItem.path.startsWith("/")) {
          const path = resolvePath(gridItem.path);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`路径 ${path} 在 ${location} 中不存在`);

          gridItem.path = path;
        } else {
          const paths = pageId.split("/");

          paths.pop();

          const path = resolvePath(`${paths.join("/")}/${gridItem.path}`);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`路径 ${path} 在 ${location} 中不存在`);

          gridItem.path = path;
        }
    });

  return grid;
};
