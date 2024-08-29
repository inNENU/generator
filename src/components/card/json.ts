import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";

import type { CardComponentOptions } from "./typings.js";
import { checkFile, checkIcon, resolvePath } from "../../utils.js";

export const getCardJSON = (
  card: CardComponentOptions,
  pageId: string,
  location = "",
): CardComponentOptions => {
  checkKeys(
    card,
    {
      tag: "string",
      cover: ["string", "undefined"],
      path: ["string", "undefined"],
      url: ["string", "undefined"],
      title: "string",
      desc: ["string", "undefined"],
      logo: ["string", "undefined"],
      name: ["string", "undefined"],
      appId: ["string", "undefined"],
      extraData: ["Record<string, any>", "undefined"],
      versionType: {
        type: ["string", "undefined"],
        enum: ["develop", "trial", "release", undefined],
      },
      env: ["string[]", "undefined"],
    },
    location,
  );

  checkIcon(card.logo, location);
  checkFile(card.cover, location);

  if ("path" in card && !("appId" in card)) {
    if (card.path.startsWith("/")) {
      const path = resolvePath(card.path);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`Path ${path} not exists in ${location}`);

      card.path = path;
    } else {
      const paths = pageId.split("/");

      paths.pop();

      const path = resolvePath(`${paths.join("/")}/${card.path}`);

      if (!existsSync(`./pages/${path}.yml`))
        console.error(`Path ${path} not exists in ${location}`);

      card.path = path;
    }
  }

  return card;
};
