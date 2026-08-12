import { resolvePagePath } from "../../utils.js";
import type { FunctionalListComponentOptions, ListComponentOptions } from "./schema.js";

export const getListJSON = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  pageId: string,
): ListComponentOptions | FunctionalListComponentOptions => {
  if (list.tag === "list") {
    // 处理列表项的路径
    if (Array.isArray(list.items)) {
      list.items.forEach((listItem) => {
        // 处理路径
        if ("path" in listItem && listItem.path)
          listItem.path = resolvePagePath(listItem.path, pageId);
      });
    }
  }
  // 处理功能列表项的路径
  else if (Array.isArray(list.items)) {
    list.items.forEach((listItem) => {
      if ("type" in listItem && listItem.type === "navigator") listItem.openType ??= "navigate";

      // 处理路径（仅对 navigator 类型或基础类型的列表项）
      if ("path" in listItem && listItem.path && !("appId" in listItem))
        listItem.path = resolvePagePath(listItem.path, pageId);
    });
  }

  return list;
};
