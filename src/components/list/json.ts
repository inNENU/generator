import { existsSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";

import type {
  FunctionalListComponentOptions,
  ListComponentOptions,
} from "./typings.js";
import { checkIcon, resolvePath } from "../../utils.js";

export const getListJSON = (
  list: ListComponentOptions | FunctionalListComponentOptions,
  pageId: string,
  location = "",
): ListComponentOptions | FunctionalListComponentOptions => {
  if (Array.isArray(list.items))
    list.items.forEach((listItem, index) => {
      checkIcon(listItem.icon, location);

      if ("type" in listItem) {
        if (listItem.type === "navigator") {
          listItem.openType ??= "navigate";

          checkKeys(
            listItem,
            {
              text: "string",
              icon: ["string", "undefined"],
              base64Icon: ["string", "undefined"],
              desc: ["string", "undefined"],
              type: {
                type: "string",
                enum: ["navigator"],
              },
              openType: {
                type: ["string"],
                enum: [
                  "navigate",
                  "redirect",
                  "switchTab",
                  "reLaunch",
                  "navigateBack",
                  "exit",
                  undefined,
                ],
              },
              target: {
                type: ["string", "undefined"],
                enum: ["self", "miniProgram", undefined],
              },
              url: ["string", "undefined"],
              env: ["string[]", "undefined"],
            },
            `${location}.content[${index}]`,
          );
        } else if (listItem.type === "switch")
          checkKeys(
            listItem,
            {
              text: "string",
              icon: ["string", "undefined"],
              base64Icon: ["string", "undefined"],
              desc: ["string", "undefined"],
              type: {
                type: "string",
                enum: ["switch"],
              },
              key: "string",
              handler: ["string", "undefined"],
              color: ["string", "undefined"],
              env: ["string[]", "undefined"],
            },
            `${location}.content[${index}]`,
          );
        else if (listItem.type === "slider")
          checkKeys(
            listItem,
            {
              text: "string",
              icon: ["string", "undefined"],
              base64Icon: ["string", "undefined"],
              desc: ["string", "undefined"],
              type: {
                type: "string",
                enum: ["slider"],
              },
              key: "string",
              handler: ["string", "undefined"],
              min: ["number", "undefined"],
              max: ["number", "undefined"],
              step: ["number", "undefined"],
              env: ["string[]", "undefined"],
            },
            `${location}.content[${index}]`,
          );
        else if (listItem.type === "picker")
          checkKeys(
            listItem,
            {
              text: "string",
              icon: ["string", "undefined"],
              base64Icon: ["string", "undefined"],
              desc: ["string", "undefined"],
              type: {
                type: "string",
                enum: ["picker"],
              },
              select: "array",
              key: "string",
              handler: ["string", "undefined"],
              single: ["boolean", "undefined"],
              inlay: ["boolean", "undefined"],
              env: ["string[]", "undefined"],
            },
            `${location}.content[${index}]`,
          );
        else if (listItem.type === "button")
          checkKeys(
            listItem,
            {
              text: "string",
              icon: ["string", "undefined"],
              base64Icon: ["string", "undefined"],
              desc: ["string", "undefined"],
              type: {
                type: "string",
                enum: ["button"],
              },
              handler: ["string", "undefined"],
              openType: {
                type: ["string", "undefined"],
                enum: [
                  "contact",
                  "share",
                  "launchApp",
                  "openSetting",
                  "feedback",
                  "getPhoneNumber",
                  "openGroupProfile",
                  "addFriend",
                  "addColorSign",
                  "openPublicProfile",
                  "openGuildProfile",
                  "addGroupApp",
                  "shareMessageToFriend",
                  "addToFavorites",
                  undefined,
                ],
              },
              openId: ["string", "undefined"],
              groupId: ["string", "undefined"],
              guildId: ["string", "undefined"],
              disabled: ["boolean", "undefined"],
              env: ["string[]", "undefined"],
            },
            `${location}.content[${index}]`,
          );
        else
          console.error(
            `unknown list type in ${location}.content[${index}]:`,
            listItem,
          );
      }
      // 处理路径
      else if (listItem.path) {
        if (listItem.path.startsWith("/")) {
          const path = resolvePath(listItem.path);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`Path ${path} not exists in ${location}`);

          listItem.path = path;
        } else {
          const paths = pageId.split("/");

          paths.pop();

          const path = resolvePath(`${paths.join("/")}/${listItem.path}`);

          if (!existsSync(`./pages/${path}.yml`))
            console.error(`Path ${path} not exists in ${location}`);

          listItem.path = path;
        }

        checkKeys(
          listItem,
          {
            text: "string",
            icon: ["string", "undefined"],
            base64Icon: ["string", "undefined"],
            desc: ["string", "undefined"],
            path: ["string"],
            url: ["string", "undefined"],
            env: ["string[]", "undefined"],
          },
          `${location}.content[${index}]`,
        );
      } else
        checkKeys(
          listItem,
          {
            text: "string",
            icon: ["string", "undefined"],
            base64Icon: ["string", "undefined"],
            desc: ["string", "undefined"],
            url: ["string", "undefined"],
            env: ["string[]", "undefined"],
          },
          `${location}.content[${index}]`,
        );
    });

  checkKeys(
    list,
    {
      tag: "string",
      header: ["string", "boolean", "undefined"],
      items: "array",
      footer: ["string", "undefined"],
      env: ["string[]", "undefined"],
    },
    location,
  );

  return list;
};
