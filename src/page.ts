import { readFileSync, writeFileSync } from "node:fs";

import { checkKeys } from "@mr-hope/assert-type";
import upath from "upath";

import { getAccountJSON } from "./components/account/json.js";
import { getActionJSON } from "./components/action/json.js";
import { getAudioJSON } from "./components/audio/json.js";
import { getCardJSON } from "./components/card/json.js";
import { getCarouselJSON } from "./components/carousel/json.js";
import { getDocJSON } from "./components/doc/json.js";
import { getFooterJSON } from "./components/footer/json.js";
import { getGridJSON } from "./components/grid/json.js";
import { getImgJSON } from "./components/img/json.js";
import { getListJSON } from "./components/list/json.js";
import { getLocationJSON } from "./components/location/json.js";
import type {
  ComponentOptions,
  PageConfig,
  PageData,
} from "./components/page.js";
import { getPhoneJSON } from "./components/phone/json.js";
import { getTableJSON } from "./components/table/json.js";
import { getTextJSON } from "./components/text/json.js";
import { getTitleJSON } from "./components/title/json.js";
import { getVideoJSON } from "./components/video/json.js";
import { _config } from "./config.js";
import { checkIcon } from "./utils.js";

export const getPageContent = (
  content: ComponentOptions[],
  pagePath: string,
  id = pagePath,
): ComponentOptions[] =>
  content.map((element, index) => {
    const { tag } = element;
    /** 当前位置 */
    const position = `${pagePath} page.content[${index}]`;

    if (tag === "img") return getImgJSON(element, position);

    if (tag === "title") return getTitleJSON(element, position);

    if (tag === "text" || tag === "p" || tag === "ul" || tag === "ol")
      return getTextJSON(element, id, position);

    if (tag === "doc") return getDocJSON(element, position);

    if (tag === "list" || tag === "functional-list")
      return getListJSON(element, id, position);

    if (tag === "grid") return getGridJSON(element, id, position);

    if (tag === "footer") return getFooterJSON(element, position);

    if (tag === "phone") return getPhoneJSON(element, position);

    if (tag === "carousel") return getCarouselJSON(element, position);

    if (tag === "account") return getAccountJSON(element, position);

    if (tag === "card") return getCardJSON(element, id, position);

    if (tag === "action") return getActionJSON(element, position);

    if (tag === "audio") return getAudioJSON(element, position);

    if (tag === "video") return getVideoJSON(element, position);

    if (tag === "location") return getLocationJSON(element, position);

    if (tag === "table") return getTableJSON(element, position);

    console.error(
      `${pagePath} page.content[${index}] 存在非法 tag ${
        tag as unknown as string
      }`,
    );

    return element;
  });

/**
 * 处理页面数据
 *
 * @param page 页面数据
 * @param pagePath 页面路径
 *
 * @returns 处理之后的page
 */
export const getPageJSON = (
  page: PageConfig,
  pagePath = "",
  diffFiles: string[] = [],
): PageData => {
  if (!page) throw new Error(`${pagePath} doesn't contain anything`);

  if (!page.content)
    throw new Error(`${pagePath}.content doesn't contain anything`);

  const { id = pagePath, author, cite, content, time, ...others } = page;
  const images: string[] = [];
  const pageData: PageData = {
    ...others,
    id,
    ...(author
      ? { author: Array.isArray(author) ? author.join("、") : author }
      : {}),
    cite: typeof cite === "string" ? [cite] : (cite ?? []),
    content: getPageContent(content, pagePath, id),
  };

  if (!pageData.cite?.length) delete page.cite;
  if (images.length) pageData.images = images;

  if (time) {
    const pageYAMLPath = upath.join(_config.pageFolder, `${pagePath}.yml`);

    // update time
    if (diffFiles.includes(pageYAMLPath)) {
      const date = new Date();

      const timeText = `${date.getFullYear()} 年 ${
        date.getMonth() + 1
      } 月 ${date.getDate()} 日${
        (date.getHours() !== 0 && date.getHours() !== 8) ||
        date.getMinutes() ||
        date.getSeconds()
          ? ` ${date.toTimeString().split(" ")[0]}`
          : ""
      }`;

      writeFileSync(
        pageYAMLPath,
        readFileSync(pageYAMLPath, { encoding: "utf-8" }).replace(
          /^time: .+$/m,
          `time: ${date.toISOString()}`,
        ),
        { encoding: "utf-8" },
      );
      pageData.time = timeText;
    } else {
      const timeText = `${time.getFullYear()} 年 ${
        time.getMonth() + 1
      } 月 ${time.getDate()} 日${
        (time.getHours() !== 0 && time.getHours() !== 8) ||
        time.getMinutes() ||
        time.getSeconds()
          ? ` ${time.toTimeString().split(" ")[0]}`
          : ""
      }`;

      pageData.time = timeText;
    }
  }

  checkIcon(page.icon, pagePath);

  checkKeys(
    pageData,
    {
      title: "string",
      id: "string",
      // icon: "string",
      icon: ["string", "undefined"],
      desc: ["string", "undefined"],
      author: ["string", "undefined"],
      time: ["string", "undefined"],
      grey: ["boolean", "undefined"],
      content: "array",
      hidden: ["boolean", "undefined"],
      shareable: ["boolean", "undefined"],
      contact: ["boolean", "undefined"],
      outdated: ["boolean", "undefined"],
      cite: ["string[]", "undefined"],
      photo: ["string[]", "undefined"],
      images: ["string[]", "undefined"],
    },
    `${pagePath} page`,
  );

  return pageData;
};
