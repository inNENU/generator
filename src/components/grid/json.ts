import { resolvePagePath } from "../../utils.js";
import type { GridComponentOptions } from "./schema.js";

export const getGridJSON = (grid: GridComponentOptions, pageId: string): GridComponentOptions => {
  if (Array.isArray(grid.items)) {
    grid.items.forEach((gridItem) => {
      // 处理路径
      if ("path" in gridItem && !("appId" in gridItem))
        gridItem.path = resolvePagePath(gridItem.path, pageId);
    });
  }

  return grid;
};
