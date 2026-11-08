import { resolvePagePath } from "../../utils.js";
import { omitEmptyPath } from "../utils.js";
import type { FunctionalListComponentOptions, ListComponentOptions } from "./schema.js";

export const getListJSON = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  pageId: string,
): ListComponentOptions | FunctionalListComponentOptions => {
  if (list.tag === "list") {
    // 处理列表项的路径
    if (Array.isArray(list.items)) {
      return {
        ...list,
        items: list.items.map((listItem) => {
          // 复制一份，避免修改调用方传入的对象
          const item = omitEmptyPath(listItem);

          // 处理路径
          if ("path" in item && item.path) {
            const resolvedPath = resolvePagePath(item.path, pageId);

            if (resolvedPath) item.path = resolvedPath;
          }

          return item;
        }),
      };
    }
  }
  // 处理功能列表项的路径
  else if (Array.isArray(list.items)) {
    return {
      ...list,
      items: list.items.map((listItem) => {
        // 复制一份，避免修改调用方传入的对象
        const item = omitEmptyPath(listItem);

        if ("type" in item && item.type === "navigator") {
          item.openType ??= "navigate";
          // 存在 appId 时默认为跳转其他小程序
          if ("appId" in item) item.target ??= "miniProgram";
        }

        // 处理路径（仅对 navigator 类型或基础类型的列表项）
        if ("path" in item && item.path && !("appId" in item)) {
          const resolvedPath = resolvePagePath(item.path, pageId);

          if (resolvedPath) item.path = resolvedPath;
        }

        return item;
      }),
    };
  }

  return { ...list };
};
