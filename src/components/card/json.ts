import { existsSync } from "node:fs";

import type { CardComponentOptions } from "./schema.js";
import { checkCard } from "./schema.js";
import { resolvePath } from "../../utils.js";

export const getCardJSON = (
  card: CardComponentOptions,
  pageId: string,
  location = "",
): CardComponentOptions => {
  checkCard(card, location);

  if ("path" in card && !("appId" in card)) {
    if (card.path.startsWith("/")) {
      const path = resolvePath(card.path);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`路径 ${path} 在 ${location} 中不存在`);

      card.path = path;
    } else {
      const paths = pageId.split("/");

      paths.pop();

      const path = resolvePath(`${paths.join("/")}/${card.path}`);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`路径 ${path} 在 ${location} 中不存在`);

      card.path = path;
    }
  }

  return card;
};
