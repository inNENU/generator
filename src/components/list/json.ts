import { existsSync } from "node:fs";

import { resolvePath } from "../../utils.js";
import type { FunctionalListComponentOptions, ListComponentOptions } from "./schema.js";

export const getListJSON = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  pageId: string,
  location = "",
): ListComponentOptions | FunctionalListComponentOptions => {
  if (list.tag === "list") {
    // 处理列表项的路径
    if (Array.isArray(list.items)) {
      list.items.forEach((listItem) => {
        // 处理路径
        if ("path" in listItem && listItem.path) {
          let path: string;

          if (listItem.path.startsWith("/")) {
            path = resolvePath(listItem.path);
          } else {
            const paths = pageId.split("/");

            paths.pop();

            path = resolvePath(`${paths.join("/")}/${listItem.path}`);
          }

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`路径 ${path} 在 ${location} 中不存在`);

          listItem.path = path;
        }
      });
    }
  }
  // 处理功能列表项的路径
  else if (Array.isArray(list.items)) {
    list.items.forEach((listItem) => {
      if ("type" in listItem && listItem.type === "navigator") listItem.openType ??= "navigate";

      // 处理路径（仅对 navigator 类型或基础类型的列表项）
      if ("path" in listItem && listItem.path && !("appId" in listItem)) {
        let path: string;

        if (listItem.path.startsWith("/")) {
          path = resolvePath(listItem.path);
        } else {
          const paths = pageId.split("/");

          paths.pop();

          path = resolvePath(`${paths.join("/")}/${listItem.path}`);
        }

        if (!existsSync(`./pages/${path}.yml`))
          console.error(`路径 ${path} 在 ${location} 中不存在`);
        listItem.path = path;
      }
    });
  }

  return list;
};
