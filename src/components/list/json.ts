import { existsSync } from "node:fs";

import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "./schema.js";
import { checkFunctionalList, checkList } from "./schema.js";
import { resolvePath } from "../../utils.js";

export const getListJSON = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  pageId: string,
  location = "",
): ListComponentOptions | FunctionalListComponentOptions => {
  if (list.tag === "list") {
    checkList(list, location);

    // 处理列表项的路径
    if (Array.isArray(list.items))
      list.items.forEach((listItem) => {
        // 处理路径
        if ("path" in listItem && listItem.path) {
          if (listItem.path.startsWith("/")) {
            const path = resolvePath(listItem.path);

            if (!existsSync(`./pages/${path}.yml`))
              console.error(`路径 ${path} 在 ${location} 中不存在`);

            listItem.path = path;
          } else {
            const paths = pageId.split("/");

            paths.pop();

            const path = resolvePath(`${paths.join("/")}/${listItem.path}`);

            if (!existsSync(`./pages/${path}.yml`))
              console.error(`路径 ${path} 在 ${location} 中不存在`);

            listItem.path = path;
          }
        }
      });
  } else {
    checkFunctionalList(list, location);

    // 处理功能列表项的路径
    if (Array.isArray(list.items))
      list.items.forEach((listItem) => {
        if ("type" in listItem && listItem.type === "navigator")
          listItem.openType ??= "navigate";

        // 处理路径（仅对 navigator 类型或基础类型的列表项）
        if ("path" in listItem && listItem.path && !("appId" in listItem)) {
          if (listItem.path.startsWith("/")) {
            const path = resolvePath(listItem.path);

            if (!existsSync(`./pages/${path}.yml`))
              console.error(`路径 ${path} 在 ${location} 中不存在`);

            listItem.path = path;
          } else {
            const paths = pageId.split("/");

            paths.pop();

            const path = resolvePath(`${paths.join("/")}/${listItem.path}`);

            if (!existsSync(`./pages/${path}.yml`))
              console.error(`路径 ${path} 在 ${location} 中不存在`);

            listItem.path = path;
          }
        }
      });
  }

  return list;
};
