import { readFileSync, writeFileSync } from "node:fs";

import upath from "upath";

import type {
  CheckPageConfigOptions,
  ComponentOptions,
  PageConfig,
  PageData,
} from "./schema.js";
import { getAccountJSON } from "../components/account/json.js";
import { getActionJSON } from "../components/action/json.js";
import { getAudioJSON } from "../components/audio/json.js";
import { getCardJSON } from "../components/card/json.js";
import { getCarouselJSON } from "../components/carousel/json.js";
import { getDocJSON } from "../components/doc/json.js";
import { getFooterJSON } from "../components/footer/json.js";
import { getGridJSON } from "../components/grid/json.js";
import { getImgJSON } from "../components/img/json.js";
import { getListJSON } from "../components/list/json.js";
import { getLocationJSON } from "../components/location/json.js";
import { getPhoneJSON } from "../components/phone/json.js";
import { getTableJSON } from "../components/table/json.js";
import { getTextJSON } from "../components/text/json.js";
import { getTitleJSON } from "../components/title/json.js";
import { getVideoJSON } from "../components/video/json.js";
import { _config } from "../config.js";
import { checkPageConfig, checkPageContent } from "./schema.js";

export const getPageContent = (
  content: ComponentOptions[],
  pagePath: string,
  { id = pagePath, check = false }: { id?: string; check?: boolean } = {},
): ComponentOptions[] => {
  try {
    if (check) checkPageContent(content, pagePath);

    return content.map((element, index) => {
      const { tag } = element;
      /** 当前位置 */
      const position = `${pagePath} page.content[${index}]`;

      switch (tag) {
        case "title":
          return getTitleJSON(element);

        case "text":
        case "p":
        case "ul":
        case "ol":
          return getTextJSON(element, id, position);

        case "img":
          return getImgJSON(element);

        case "list":
        case "functional-list":
          return getListJSON(element, id, position);

        case "doc":
          return getDocJSON(element);

        case "grid":
          return getGridJSON(element, id, position);

        case "footer":
          return getFooterJSON(element);

        case "phone":
          return getPhoneJSON(element);

        case "carousel":
          return getCarouselJSON(element);

        case "account":
          return getAccountJSON(element);

        case "card":
          return getCardJSON(element, id, position);

        case "action":
          return getActionJSON(element);

        case "audio":
          return getAudioJSON(element);

        case "video":
          return getVideoJSON(element);

        case "location":
          return getLocationJSON(element, position);

        case "table":
          return getTableJSON(element);

        default:
          console.error(
            `${pagePath} page.content[${index}] 存在非法 tag ${
              tag as unknown as string
            }`,
          );

          return element;
      }
    });
  } catch (error) {
    throw new Error(
      `${pagePath} page.content 处理失败: ${(error as Error).message}`,
    );
  }
};

export interface GetPageJSONOptions extends CheckPageConfigOptions {
  /**
   * 是否检查页面内容
   *
   * @default false
   */
  check?: boolean;
  /** 需要移除的字段 */
  removeFields?: string[];
}

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
  options: GetPageJSONOptions = {},
): PageData => {
  if (options.check) checkPageConfig(page, pagePath, options);

  try {
    if (!page) throw new Error(`${pagePath} 不存在内容`);

    if (!page.content) throw new Error(`${pagePath}.content 不存在内容`);

    if (!Array.isArray(page.content))
      throw new Error(`${pagePath}.content 应为数组`);

    const { id = pagePath, author, cite, content, time, ...others } = page;
    const images: string[] = [];
    const pageData: PageData = {
      ...others,
      id,
      ...(author
        ? { author: Array.isArray(author) ? author.join("、") : author }
        : {}),
      cite: typeof cite === "string" ? [cite] : (cite ?? []),
      content: getPageContent(content, pagePath, { id }),
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

    if (options.removeFields?.length) {
      options.removeFields.forEach((field) => {
        if (field in pageData) {
          delete pageData[field as keyof PageData];
        }
      });
    }

    return pageData;
  } catch (error) {
    throw new Error(`${pagePath} 页面处理失败: ${(error as Error).message}`);
  }
};
