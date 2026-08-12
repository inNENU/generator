import { resolvePagePath } from "../../utils.js";
import type { CardComponentOptions } from "./schema.js";

export const getCardJSON = (card: CardComponentOptions, pageId: string): CardComponentOptions => {
  if ("path" in card && !("appId" in card)) card.path = resolvePagePath(card.path, pageId);

  return card;
};
