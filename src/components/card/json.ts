import { resolvePagePath } from "../../utils.js";
import { omitEmptyPath } from "../utils.js";
import type { CardComponentOptions } from "./schema.js";

export const getCardJSON = (card: CardComponentOptions, pageId: string): CardComponentOptions => {
  // 复制一份，避免修改调用方传入的对象
  const data = omitEmptyPath(card);

  if ("path" in data && !("appId" in data)) {
    const resolvedPath = resolvePagePath(data.path, pageId);

    if (resolvedPath) data.path = resolvedPath;
  }

  return data;
};
