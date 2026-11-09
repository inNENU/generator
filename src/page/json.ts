// oxlint-disable import/max-dependencies
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

import { join } from "upath";

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
import { generatorConfig } from "../config.js";
import { ValidationError } from "../helpers/validation.js";
import type { CheckPageConfigOptions, ComponentOptions, PageConfig, PageData } from "./schema.js";
import { checkPageConfig, checkPageContent } from "./schema.js";

/**
 * 处理页面内容
 *
 * @param content 页面内容
 * @param pagePath 页面路径
 * @param options 处理选项
 * @returns 处理后的页面内容
 */
export const getPageContent = (
  content: ComponentOptions[],
  pagePath: string,
  { id = pagePath, check = true }: { id?: string; check?: boolean } = {},
): ComponentOptions[] => {
  try {
    if (check) {
      const issues = checkPageContent(content, pagePath, id);

      if (issues.length) throw new ValidationError(`${pagePath} 页面内容校验失败`, issues);
    }

    return content.map((element, index) => {
      const { tag } = element;
      /** 当前位置 */
      const position = `${pagePath} page.content[${index}]`;

      switch (tag) {
        case "title": {
          return getTitleJSON(element);
        }

        case "text":
        case "p":
        case "ul":
        case "ol": {
          return getTextJSON(element, id, position);
        }

        case "img": {
          return getImgJSON(element);
        }

        case "list":
        case "functional-list": {
          return getListJSON(element, id);
        }

        case "doc": {
          return getDocJSON(element);
        }

        case "grid": {
          return getGridJSON(element, id);
        }

        case "footer": {
          return getFooterJSON(element);
        }

        case "phone": {
          return getPhoneJSON(element);
        }

        case "carousel": {
          return getCarouselJSON(element);
        }

        case "account": {
          return getAccountJSON(element);
        }

        case "card": {
          return getCardJSON(element, id);
        }

        case "action": {
          return getActionJSON(element);
        }

        case "audio": {
          return getAudioJSON(element);
        }

        case "video": {
          return getVideoJSON(element);
        }

        case "location": {
          return getLocationJSON(element, position);
        }

        case "table": {
          return getTableJSON(element);
        }

        default: {
          throw new Error(
            `${pagePath} page.content[${index}] 存在非法 tag ${tag as unknown as string}`,
          );
        }
      }
    });
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    throw new Error(`${pagePath} page.content 处理失败: ${(err as Error).message}`, { cause: err });
  }
};

export interface GetPageJSONOptions extends CheckPageConfigOptions {
  /**
   * 是否进行完整性校验
   *
   * 为 true 时同时检查页面配置、内容组件及 `$img`/`$file` 资源可达性；为 false 时整体跳过，不检查任何内容。
   *
   * @default true
   */
  check?: boolean;
  /** 需要移除的字段 */
  removeFields?: string[];
}

/**
 * 将页面配置中的可选字段复制到页面数据 (PageData) 上
 *
 * @param pageData 页面数据
 * @param page 页面配置
 * @param author 页面作者
 * @param cite 页面引用来源
 */
const updateOptionalPageDataFields = (
  pageData: PageData,
  page: PageConfig,
  author: PageConfig["author"],
  cite: PageConfig["cite"],
): void => {
  if (page.icon) pageData.icon = page.icon;
  if (page.desc) pageData.desc = page.desc;
  if (author) pageData.author = Array.isArray(author) ? author.join("、") : author;
  if (cite) pageData.cite = typeof cite === "string" ? [cite] : cite;
  if (typeof page.grey === "boolean") pageData.grey = page.grey;
  if (typeof page.outdated === "boolean") pageData.outdated = page.outdated;
  if (typeof page.shareable === "boolean") pageData.shareable = page.shareable;
  if (typeof page.qrcode === "string" || typeof page.qrcode === "boolean")
    pageData.qrcode = page.qrcode;
  if (typeof page.contact === "boolean") pageData.contact = page.contact;
};

/** 页面时间输出时区：中国标准时间 */
const PAGE_TIME_ZONE = "Asia/Shanghai";

/** 不带时区标记的 ISO 日期时间（秒与毫秒可选） */
const ISO_DATETIME_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/u;

/** 按 `Asia/Shanghai` 输出年月日与时分秒的格式化器 */
const pageTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PAGE_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * 解析页面时间
 *
 * 不带时区标记的 ISO 日期时间按 `Asia/Shanghai` 墙钟解析，避免解析结果随构建机器的 `process.env.TZ` 变化； 其余字符串交给 `Date` 解析。
 *
 * @param time 时间字符串
 * @returns 解析后的日期
 */
const parsePageTime = (time: string): Date => {
  if (!ISO_DATETIME_WITHOUT_ZONE.test(time)) return new Date(time);

  // `Asia/Shanghai` 自 1991 年 9 月起固定为 UTC+8；1986–1991 年中国实行夏令时，
  // 该期间不带时区的历史时间仍按 +08:00 解释，可能有 1 小时偏差（已知边界）
  return new Date(`${time.replace(" ", "T")}+08:00`);
};

/**
 * 按 `Asia/Shanghai` 格式化日期时间
 *
 * @param date 待格式化的日期
 * @returns `YYYY 年 M 月 D 日 HH:mm:ss` 文本
 */
const formatPageDateTime = (date: Date): string => {
  const parts = pageTimeFormatter.formatToParts(date);

  const getPart = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")} 年 ${Number(getPart("month"))} 月 ${Number(
    getPart("day"),
  )} 日 ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
};

/**
 * 格式化页面时间
 *
 * 日期字符串（`YYYY-MM-DD`）只输出日期，避免被解析为 UTC 零点后按本地时区显示成前一天或 08:00； 其他 ISO 日期时间统一按
 * `Asia/Shanghai`（UTC+8）输出完整的年月日与 `HH:mm:ss`。不带时区标记的时间按北京时间墙钟解析， 因此输出不依赖构建机器的 `process.env.TZ`。
 *
 * 仅支持 `Date` 与 ISO 日期/日期时间字符串，不支持 number 时间戳。已知边界：1986–1991 年中国实行夏令时， 该期间不带时区标记的历史时间按 UTC+8 解释，可能产生
 * 1 小时偏差。
 *
 * @param time 页面时间（ISO 日期/日期时间字符串或 Date）
 * @returns 用于展示的时间文本
 */
const formatPageTime = (time: string | Date): string => {
  if (typeof time === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(time)) {
    const [year, month, day] = time.split("-").map(Number);
    const dateOnly = new Date(year, month - 1, day);

    return `${dateOnly.getFullYear()} 年 ${dateOnly.getMonth() + 1} 月 ${dateOnly.getDate()} 日`;
  }

  const date = typeof time === "string" ? parsePageTime(time) : time;

  if (Number.isNaN(date.getTime())) throw new TypeError(`无法解析页面时间: ${String(time)}`);

  return formatPageDateTime(date);
};

/**
 * 更新页面 YAML 中的最后更新时间
 *
 * 先写入临时文件再原子替换，避免写入中途失败破坏源文件；源文件没有 `time` 字段时跳过写入并输出警告。
 *
 * @param pageYAMLPath 页面 YAML 文件路径
 * @returns 更新后的时间
 */
export const updatePageTime = (pageYAMLPath: string): Date => {
  if (!existsSync(pageYAMLPath)) throw new Error(`页面文件不存在: ${pageYAMLPath}`);

  const content = readFileSync(pageYAMLPath, { encoding: "utf-8" });
  const date = new Date();

  if (!/^time: .+$/mu.test(content)) {
    console.warn(`${pageYAMLPath} 中不存在 time 字段，跳过更新时间`);

    return date;
  }

  const nextContent = content.replace(/^time: .+$/mu, `time: ${date.toISOString()}`);
  const tempPath = `${pageYAMLPath}.${process.pid}.tmp`;

  try {
    writeFileSync(tempPath, nextContent, { encoding: "utf-8" });
    renameSync(tempPath, pageYAMLPath);
  } catch (err) {
    rmSync(tempPath, { force: true });

    throw err;
  }

  return date;
};

/**
 * 处理页面数据
 *
 * @param page 页面数据
 * @param pagePath 页面路径
 * @param diffFiles 变更文件列表，用于判断是否需要更新 time 字段
 * @param options 处理选项
 * @returns 处理之后的page
 */
export const getPageJSON = (
  page: PageConfig,
  pagePath = "",
  diffFiles: string[] = [],
  options: GetPageJSONOptions = {},
): PageData => {
  const { check = true } = options;
  const changedFiles = new Set(diffFiles);

  try {
    if (!page) throw new Error(`${pagePath} 不存在内容`);

    if (!page.content) throw new Error(`${pagePath}.content 不存在内容`);

    if (!Array.isArray(page.content)) throw new TypeError(`${pagePath}.content 应为数组`);

    const { id = pagePath, author, cite, content, time } = page;

    if (check) {
      const contentIssues = checkPageContent(content, pagePath, id);

      if (contentIssues.length)
        throw new ValidationError(`${pagePath} 页面内容校验失败`, contentIssues);

      const configIssues = checkPageConfig(page, pagePath, options);

      if (configIssues.length)
        throw new ValidationError(`${pagePath} 页面配置校验失败`, configIssues);
    }

    const pageData: PageData = {
      title: page.title,
      id,
      content: getPageContent(content, pagePath, { id, check: false }),
    };

    updateOptionalPageDataFields(pageData, page, author, cite);

    if (!pageData.cite?.length) delete pageData.cite;

    if (time) {
      const pageYAMLPath = join(generatorConfig.pageFolder, `${pagePath}.yml`);
      const date = changedFiles.has(pageYAMLPath) ? updatePageTime(pageYAMLPath) : time;

      pageData.time = formatPageTime(date);
    }

    if (options.removeFields?.length) {
      options.removeFields.forEach((field) => {
        // oxlint-disable-next-line typescript/no-dynamic-delete
        if (field in pageData) delete pageData[field as keyof PageData];
      });
    }

    return pageData;
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    throw new Error(`${pagePath} 页面处理失败: ${(err as Error).message}`, { cause: err });
  }
};
