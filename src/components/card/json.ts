import { existsSync } from "node:fs";

import { resolvePath } from "../../utils.js";
import type { CardComponentOptions } from "./schema.js";

export const getCardJSON = (
  card: CardComponentOptions,
  pageId: string,
  location = "",
): CardComponentOptions => {
  if ("path" in card && !("appId" in card)) {
    let path: string;

    if (card.path.startsWith("/")) {
      path = resolvePath(card.path);
    } else {
      const paths = pageId.split("/");

      paths.pop();

      path = resolvePath(`${paths.join("/")}/${card.path}`);
    }

    if (!existsSync(`./pages/${path}.yml`)) console.error(`路径 ${path} 在 ${location} 中不存在`);

    card.path = path;
  }

  return card;
};
