import { resolvePagePath } from "../../utils.js";
import { omitEmptyPath } from "../utils.js";
import type { GridComponentOptions } from "./schema.js";

export const getGridJSON = (grid: GridComponentOptions, pageId: string): GridComponentOptions => ({
  ...grid,
  items: Array.isArray(grid.items)
    ? grid.items.map((gridItem) => {
        // 复制一份，避免修改调用方传入的对象
        const item = omitEmptyPath(gridItem);

        // 处理路径
        if ("path" in item && !("appId" in item)) {
          const resolvedPath = resolvePagePath(item.path, pageId);

          if (resolvedPath) item.path = resolvedPath;
        }

        return item;
      })
    : grid.items,
});
