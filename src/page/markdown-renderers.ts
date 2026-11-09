// oxlint-disable import/max-dependencies
import { getAccountMarkdown } from "../components/account/markdown.js";
import { getActionMarkdown } from "../components/action/markdown.js";
import { getAudioMarkdown } from "../components/audio/markdown.js";
import { getCardMarkdown } from "../components/card/markdown.js";
import { getCarouselMarkdown } from "../components/carousel/markdown.js";
import { getDocMarkdown } from "../components/doc/markdown.js";
import { getDocDisplayName } from "../components/doc/utils.js";
import { getGridMarkdown } from "../components/grid/markdown.js";
import { getImgMarkdown } from "../components/img/markdown.js";
import { getListMarkdown } from "../components/list/markdown.js";
import { getLocationMarkdown, getLocationMarkerUrl } from "../components/location/markdown.js";
import { getPhoneMarkdown } from "../components/phone/markdown.js";
import { getTableMarkdown } from "../components/table/markdown.js";
import { getTextMarkdown } from "../components/text/markdown.js";
import { getTitleMarkdown } from "../components/title/markdown.js";
import { getVideoMarkdown } from "../components/video/markdown.js";
import { sanitizeUrl } from "../helpers/url.js";
import type { MarkdownMode, UrlHandler } from "../typings.js";
import {
  escapeContainerBodySyntax,
  escapeHtml,
  escapeMarkdownLinkLabel,
  formatMarkdownDestination,
  getFileLink,
  normalizeInlineText,
} from "../utils.js";
import type { ComponentOptions } from "./schema.js";

/** URL 转换结果 */
interface UrlConversion {
  /** 小程序端跳转形式 */
  miniapp: string;
  /** 网页端地址 */
  web: string;
}

/** 组件 URL 转换器 */
type ComponentUrlConverter = (url: string) => string | UrlConversion | null | undefined;

/** 组件 Markdown 渲染选项 */
export interface ComponentMarkdownOptions {
  /** 输出方言：`vuepress` 生成站点 Markdown，`text` 生成知识库文本 Markdown */
  dialect?: "vuepress" | "text";
  /** 组件位置，用于错误信息 */
  location?: string;
  /** 渲染模式 */
  mode?: MarkdownMode;
  /** URL 转换器，可返回单一地址或双端地址 */
  urlConverter?: ComponentUrlConverter;
}

/**
 * 将 URL 转换器返回值统一为双端形式
 *
 * @param converted URL 转换器返回值
 * @returns 双端地址，未转换时返回 `null`
 */
const toUrlConversion = (
  converted: string | UrlConversion | null | undefined,
): UrlConversion | null => {
  if (!converted) return null;

  if (typeof converted === "string") {
    const url = sanitizeUrl(converted);

    return url ? { miniapp: url, web: url } : null;
  }

  const miniapp = sanitizeUrl(converted.miniapp);
  const web = sanitizeUrl(converted.web);

  return miniapp && web ? { miniapp, web } : null;
};

/**
 * 生成文本管线中的段落 / 列表 Markdown
 *
 * @param component 文本组件
 * @param marker 列表标记，空字符串表示普通段落
 * @param mode 渲染模式
 * @returns Markdown 内容
 */
const renderTextBlock = (
  component: Extract<ComponentOptions, { tag: "text" | "p" | "ul" | "ol" }>,
  marker: "" | "- " | "1. ",
  mode: MarkdownMode,
): string => {
  const texts = Array.isArray(component.text)
    ? component.text
    : component.text
      ? [component.text]
      : [];
  const header = typeof component.header === "string" ? component.header : "";
  const type = "type" in component ? component.type : "none";

  if (mode === "miniapp" && type && type !== "none") {
    const typeName = type === "danger" ? "caution" : type;

    return `::: ${typeName}${header ? ` ${escapeHtml(normalizeInlineText(header))}` : ""}\n\n${texts
      .map((item) => `${marker}${escapeContainerBodySyntax(escapeHtml(item))}`)
      .join("\n\n")}\n\n:::\n\n`;
  }

  const textContent = `${header ? `### ${escapeHtml(normalizeInlineText(header))}\n\n` : ""}${texts
    .map((item) => `${marker}${escapeHtml(item)}`)
    .join("\n\n")}`;

  return textContent ? `${textContent}\n\n` : "";
};

/**
 * 生成知识库文本管线中的组件 Markdown
 *
 * @param component 页面组件
 * @param options 渲染选项
 * @returns Markdown 内容
 */
// oxlint-disable-next-line max-statements, max-lines-per-function, complexity
const renderTextComponentMarkdown = (
  component: ComponentOptions,
  options: ComponentMarkdownOptions,
): string => {
  const { mode = "web", urlConverter = (): null => null } = options;

  switch (component.tag) {
    case "title": {
      return `## ${escapeHtml(normalizeInlineText(component.text))}\n\n`;
    }

    case "text":
    case "p": {
      return renderTextBlock(component, "", mode);
    }

    case "ul": {
      return renderTextBlock(component, "- ", mode);
    }

    case "ol": {
      return renderTextBlock(component, "1. ", mode);
    }

    case "grid":
    case "list": {
      const { header, items, footer } = component;

      const renderedItems = items
        .map((item) => {
          // 带 url 的条目：交给 urlConverter 转换（返回 null/undefined 时丢弃）
          if ("url" in item && item.url) {
            const converted = toUrlConversion(urlConverter(item.url));

            if (!converted) return null;

            if (mode === "miniapp") {
              const icon = "icon" in item && item.icon ? `（icon: ${escapeHtml(item.icon)}）` : "";

              return `- ${escapeHtml(item.text)}${icon}（小程序：\`${converted.miniapp}\`）`;
            }

            return `- ${escapeHtml(item.text)}（小程序：\`${converted.miniapp}\`，[网页版](${formatMarkdownDestination(
              converted.web,
            )})）`;
          }

          const itemDesc = "desc" in item && item.desc ? ` - ${escapeHtml(item.desc)}` : "";

          if (mode === "miniapp") {
            const icon = "icon" in item && item.icon ? `（icon: ${escapeHtml(item.icon)}）` : "";
            const path = "path" in item && item.path ? `（path: ${escapeHtml(item.path)}）` : "";

            return `- ${escapeHtml(item.text)}${itemDesc}${icon}${path}`;
          }

          return `- ${escapeHtml(item.text)}${itemDesc}`;
        })
        .filter((item): item is string => item != null)
        .join("\n");

      return `\
${header ? `#### ${escapeHtml(normalizeInlineText(header))}\n\n` : ""}\
${renderedItems}

${footer ? `> ${escapeHtml(footer)}\n\n` : ""}\
`;
    }

    case "card": {
      const { title: cardTitle, desc: cardDesc, logo } = component;

      // 卡片当作列表项渲染：title→text、desc→desc、logo→icon（name/cover 等其他字段丢弃）
      // url 卡片：与列表项一致，交给 urlConverter 转换（返回 null/undefined 时丢弃）
      if ("url" in component) {
        const converted = toUrlConversion(urlConverter(component.url));

        if (!converted) return "";

        if (mode === "miniapp") {
          const icon = logo ? `（icon: ${escapeHtml(logo)}）` : "";

          return `- ${escapeHtml(cardTitle)}${icon}（小程序：\`${converted.miniapp}\`）\n\n`;
        }

        return `- ${escapeHtml(cardTitle)}（小程序：\`${converted.miniapp}\`，[网页版](${formatMarkdownDestination(
          converted.web,
        )})）\n\n`;
      }

      const itemDesc = cardDesc ? ` - ${escapeHtml(cardDesc)}` : "";

      if (mode === "miniapp") {
        const icon = logo ? `（icon: ${escapeHtml(logo)}）` : "";
        const path =
          "path" in component && component.path ? `（path: ${escapeHtml(component.path)}）` : "";

        return `- ${escapeHtml(cardTitle)}${itemDesc}${icon}${path}\n\n`;
      }

      // web：path 跳转（其他 markdown 页面）也保留
      const path =
        "path" in component && component.path ? `（path: ${escapeHtml(component.path)}）` : "";

      return `- ${escapeHtml(cardTitle)}${itemDesc}${path}\n\n`;
    }

    case "location": {
      const { header, points } = component;

      return `\
${header ? `#### ${escapeHtml(normalizeInlineText(header))}位置\n\n` : ""}\
![在腾讯地图中查看](${formatMarkdownDestination(getLocationMarkerUrl(points))})\n\n`;
    }

    case "img": {
      const { src, desc: imgDesc } = component;
      const imgLink = sanitizeUrl(mode === "miniapp" ? src : (getFileLink(src) ?? ""));

      return imgLink
        ? `![${escapeMarkdownLinkLabel(escapeHtml(imgDesc ?? ""))}](${formatMarkdownDestination(
            imgLink,
          )})\n\n`
        : "";
    }

    case "carousel": {
      const images = component.images
        .map((link) => sanitizeUrl(mode === "miniapp" ? link : (getFileLink(link) ?? "")))
        .filter((link): link is string => link != null);

      return images.length > 0
        ? `${images.map((link) => `![''](${formatMarkdownDestination(link)})\n\n`).join("\n")}\n\n`
        : "";
    }

    case "doc": {
      const { name, url } = component;
      const docUrl = sanitizeUrl(mode === "miniapp" ? url : (getFileLink(url) ?? url));
      const docName = getDocDisplayName(name, docUrl ?? "");

      return docUrl
        ? `- [${escapeMarkdownLinkLabel(escapeHtml(docName))}](${formatMarkdownDestination(docUrl)})\n\n`
        : `- ${escapeHtml(name)}\n\n`;
    }

    case "phone": {
      const {
        header = "",
        fName,
        lName = "",
        num,
        workNum,
        homeNum,
        hostNum,
        nick,
        org,
        title: contactTitle,
        remark,
        province = "",
        city = "",
        street = "",
        postCode,
        mail,
        site,
      } = component;

      const telUrl = sanitizeUrl(`tel:${num}`);
      const siteUrl = sanitizeUrl(site);
      const mailUrl = mail ? sanitizeUrl(`mailto:${mail}`) : null;

      return `\
#### ${escapeHtml(normalizeInlineText(header || `${lName}${fName} 联系方式`))}

- 姓名: ${escapeHtml(lName)}${escapeHtml(fName)}
- 电话: ${
        telUrl
          ? `[${escapeMarkdownLinkLabel(escapeHtml(String(num)))}](${formatMarkdownDestination(telUrl)})`
          : escapeHtml(String(num))
      }
${workNum ? `- 工作电话: ${escapeHtml(String(workNum))}\n` : ""}\
${hostNum ? `- 公司电话: ${escapeHtml(String(hostNum))}\n` : ""}\
${homeNum ? `- 家庭电话: ${escapeHtml(String(homeNum))}\n` : ""}\
${siteUrl ? `- 网站: <${escapeHtml(siteUrl)}>\n` : ""}\
${mail ? (mailUrl ? `- 邮箱: [${escapeMarkdownLinkLabel(escapeHtml(mail))}](${formatMarkdownDestination(mailUrl)})\n` : `- 邮箱: ${escapeHtml(mail)}\n`) : ""}\
${org ? `- 组织: ${escapeHtml(org)}\n` : ""}\
${contactTitle ? `- 职位: ${escapeHtml(contactTitle)}\n` : ""}\
${nick ? `- 昵称: ${escapeHtml(nick)}\n` : ""}\
${remark ? `- 备注: ${escapeHtml(remark)}\n` : ""}\
${province || city || street ? `- 地址: ${escapeHtml(province)}${escapeHtml(city)}${escapeHtml(street)}\n` : ""}\
${postCode ? `- 邮编: ${escapeHtml(String(postCode))}\n` : ""}\

`;
    }

    case "account": {
      const { name, detail, desc: accountDesc, logo, qq, wxid, site, mail } = component;
      const logoUrl = sanitizeUrl(mode === "miniapp" ? logo : (getFileLink(logo) ?? ""));
      const siteUrl = sanitizeUrl(site);
      const mailUrl = mail ? sanitizeUrl(`mailto:${mail}`) : null;

      return `\
${logoUrl ? `![${escapeMarkdownLinkLabel(escapeHtml(name))}](${formatMarkdownDestination(logoUrl)})\n\n` : ""}\
${name ? `- 名称: ${escapeHtml(name)}\n` : ""}\
${detail ? `- 详情: ${escapeHtml(detail)}\n` : ""}\
${accountDesc ? `- 描述: ${escapeHtml(accountDesc)}\n` : ""}\
${qq ? `- QQ: ${escapeHtml(String(qq))}\n` : ""}\
${wxid ? `- 微信公众号二维码: ![](${formatMarkdownDestination(`https://open.weixin.qq.com/qr/code?username=${encodeURIComponent(wxid)}`)})\n` : ""}\
${siteUrl ? `- 网站: <${escapeHtml(siteUrl)}>\n` : ""}\
${mail ? (mailUrl ? `- 邮箱: [${escapeMarkdownLinkLabel(escapeHtml(mail))}](${formatMarkdownDestination(mailUrl)})\n` : `- 邮箱: ${escapeHtml(mail)}\n`) : ""}\

`;
    }

    case "audio": {
      const { src, name } = component;
      const audioLink = sanitizeUrl(mode === "miniapp" ? src : (getFileLink(src) ?? ""));
      const label = `音频${name ? `: ${escapeHtml(name)}` : ""}`;

      return audioLink
        ? `[${escapeMarkdownLinkLabel(label)}](${formatMarkdownDestination(audioLink)})\n\n`
        : `${label}\n\n`;
    }

    case "video": {
      const { src, title: videoTitle } = component;
      const videoLink = sanitizeUrl(mode === "miniapp" ? src : (getFileLink(src) ?? ""));
      const label = `视频${videoTitle ? `: ${escapeHtml(videoTitle)}` : ""}`;

      return videoLink
        ? `[${escapeMarkdownLinkLabel(label)}](${formatMarkdownDestination(videoLink)})\n\n`
        : `${label}\n\n`;
    }

    default: {
      return "";
    }
  }
};

/**
 * 生成站点管线中的组件 Markdown
 *
 * @param component 页面组件
 * @param options 渲染选项
 * @returns Markdown 内容
 */
const renderVuePressComponentMarkdown = (
  component: ComponentOptions,
  options: ComponentMarkdownOptions,
): string => {
  const { location = "", urlConverter = (): null => null } = options;

  // 站点管线只认字符串地址；若调用方传入双端转换器，网页端取 web 形式。
  const webUrlConverter: UrlHandler = (url) => {
    const converted = urlConverter(url);

    return sanitizeUrl(typeof converted === "string" ? converted : converted?.web);
  };

  switch (component.tag) {
    case "img": {
      return getImgMarkdown(component, location);
    }

    case "carousel": {
      return getCarouselMarkdown(component, location);
    }

    case "title": {
      return getTitleMarkdown(component, location);
    }

    case "text":
    case "p":
    case "ul":
    case "ol": {
      return getTextMarkdown(component, location);
    }

    case "list":
    case "functional-list": {
      return getListMarkdown(component, { location, urlConverter: webUrlConverter });
    }

    case "grid": {
      return getGridMarkdown(component, { location, urlConverter: webUrlConverter });
    }

    case "doc": {
      return getDocMarkdown(component, location);
    }

    case "phone": {
      return getPhoneMarkdown(component, location);
    }

    case "card": {
      return getCardMarkdown(component, { location, urlConverter: webUrlConverter });
    }

    case "audio": {
      return getAudioMarkdown(component, location);
    }

    case "video": {
      return getVideoMarkdown(component, location);
    }

    case "account": {
      return getAccountMarkdown(component, location);
    }

    case "location": {
      return getLocationMarkdown(component, location);
    }

    default: {
      return "";
    }
  }
};

/**
 * 渲染单个页面组件
 *
 * 两条页面管线共用此入口：站点管线输出 VuePress Markdown，知识库文本管线输出 便于 AI 检索的简化 Markdown。`action` 与 `table`
 * 两种组件两端产物一致， 直接在入口处分派，避免再次漂移。
 *
 * @param component 页面组件
 * @param options 渲染选项
 * @returns Markdown 内容
 */
export const renderComponentMarkdown = (
  component: ComponentOptions,
  options: ComponentMarkdownOptions = {},
): string => {
  // Markdown 产物只服务 VuePress 站点；小程序与原生 App 直接消费 JSON，没有 Markdown 渲染需求。
  // 因此这里只把 "web" 视为可用环境，其他 env（如 wx / app）不参与 Markdown 渲染，属于有意设计而非遗漏。
  if (component.env && !component.env.includes("web")) return "";

  const { location = "", mode = "web", urlConverter } = options;

  if (component.tag === "action")
    return getActionMarkdown(component, location, { mode, urlConverter });

  if (component.tag === "table") return getTableMarkdown(component, location);

  return options.dialect === "text"
    ? renderTextComponentMarkdown(component, options)
    : renderVuePressComponentMarkdown(component, options);
};
