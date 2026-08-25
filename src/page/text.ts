// oxlint-disable max-statements
// oxlint-disable max-lines-per-function
import { getActionMarkdown } from "../components/action/markdown.js";
import { getTableMarkdown } from "../components/table/markdown.js";
import { generatorConfig } from "../config.js";
import type { PageConfig } from "../typings.js";
import { getFileLink } from "../utils.js";
import { checkPageConfig, checkPageContent } from "./schema.js";

/**
 * URL 转换器：将页面组件中的链接（如 `notice-detail?url=...`）转换为知识库可读形式。
 *
 * 返回 `{ miniapp, web }` 时该链接以"小程序优先"格式输出；返回 `null` / `undefined` 时该链接（及其所在条目）被丢弃。
 */
export interface UrlConverterResult {
  /** 小程序端跳转形式 */
  miniapp: string;
  /** 网页端地址 */
  web: string;
}

export type UrlConverter = (url: string) => UrlConverterResult | null | undefined;

export interface GetPageTextOptions {
  /** URL 转换器（见 `UrlConverter`） */
  urlConverter?: UrlConverter;
  /** 渲染模式：`web`（默认，纯标准 markdown）| `miniapp`（结构增强 markdown） */
  mode?: "web" | "miniapp";
}

/**
 * 获取页面文本
 *
 * @param page 页面数据
 * @param pagePath 页面路径
 * @param options 生成选项
 * @returns 页面文本
 */
export const getPageText = (
  page: PageConfig,
  pagePath = "",
  options: GetPageTextOptions = {},
): string => {
  try {
    if (!page) throw new Error(`${pagePath} doesn't contain anything`);

    if (!page.content) throw new Error(`${pagePath}.content doesn't contain anything`);

    checkPageConfig(page, pagePath);
    checkPageContent(page.content, pagePath, pagePath);

    const { title, desc, content } = page;

    const mode = options.mode ?? "web";

    // 不输出 cite：AI 无网络搜索能力，来源只能是小程序页面，不引用外部网址

    return `\
# ${title}

${desc ? `> 描述: ${desc}\n\n` : ""}\
${content
  // oxlint-disable-next-line complexity
  .map((component, index) => {
    const componentLocation = `${pagePath} page.content[${index}]`;

    if (component.env && !component.env.includes("web")) return "";

    switch (component.tag) {
      case "title": {
        return `## ${component.text}\n\n`;
      }

      case "text":
      case "p": {
        const texts = Array.isArray(component.text)
          ? component.text
          : component.text
            ? [component.text]
            : [];

        if (
          mode === "miniapp" &&
          "type" in component &&
          component.type &&
          component.type !== "none"
        ) {
          const typeName = component.type === "danger" ? "caution" : component.type;

          return `::: ${typeName}${component.header ? ` ${component.header}` : ""}\n\n${texts.join("\n\n")}\n\n:::\n\n`;
        }

        const textContent = `${component.header ? `### ${component.header}\n\n` : ""}${texts.join("\n\n")}`;

        return textContent ? `${textContent}\n\n` : "";
      }

      case "ul": {
        const texts = Array.isArray(component.text)
          ? component.text
          : component.text
            ? [component.text]
            : [];

        if (
          mode === "miniapp" &&
          "type" in component &&
          component.type &&
          component.type !== "none"
        ) {
          const typeName = component.type === "danger" ? "caution" : component.type;

          return `::: ${typeName}${component.header ? ` ${component.header}` : ""}\n\n${texts.map((item) => `- ${item}`).join("\n\n")}\n\n:::\n\n`;
        }

        const ulContent = `${component.header ? `### ${component.header}\n\n` : ""}${texts.map((item) => `- ${item}`).join("\n\n")}`;

        return ulContent ? `${ulContent}\n\n` : "";
      }

      case "ol": {
        const texts = Array.isArray(component.text)
          ? component.text
          : component.text
            ? [component.text]
            : [];

        if (
          mode === "miniapp" &&
          "type" in component &&
          component.type &&
          component.type !== "none"
        ) {
          const typeName = component.type === "danger" ? "caution" : component.type;

          return `::: ${typeName}${component.header ? ` ${component.header}` : ""}\n\n${texts.map((item) => `1. ${item}`).join("\n\n")}\n\n:::\n\n`;
        }

        const olContent = `${component.header ? `### ${component.header}\n\n` : ""}${texts.map((item) => `1. ${item}`).join("\n\n")}`;

        return olContent ? `${olContent}\n\n` : "";
      }

      case "grid":
      case "list": {
        const { header, items, footer } = component;

        const renderedItems = items
          .map((item) => {
            // 带 url 的条目：交给 urlConverter 转换（返回 null/undefined 时丢弃）
            if ("url" in item && item.url) {
              const converted = options.urlConverter?.(item.url);

              if (!converted) return null;

              if (mode === "miniapp") {
                const icon = "icon" in item && item.icon ? `（icon: ${item.icon}）` : "";

                return `- ${item.text}${icon}（小程序：\`${converted.miniapp}\`）`;
              }

              return `- ${item.text}（小程序：\`${converted.miniapp}\`，[网页版](${converted.web})）`;
            }

            const itemDesc = "desc" in item && item.desc ? ` - ${item.desc}` : "";

            if (mode === "miniapp") {
              const icon = "icon" in item && item.icon ? `（icon: ${item.icon}）` : "";
              const path = "path" in item && item.path ? `（path: ${item.path}）` : "";

              return `- ${item.text}${itemDesc}${icon}${path}`;
            }

            return `- ${item.text}${itemDesc}`;
          })
          .filter((item): item is string => item != null)
          .join("\n");

        return `\
${header ? `#### ${header}\n\n` : ""}\
${renderedItems}

${footer ? `> ${footer}\n\n` : ""}\
`;
      }

      case "location": {
        const { header, points } = component;

        return `\
${header ? `#### ${header}位置\n\n` : ""}\
![在腾讯地图中查看](https://apis.map.qq.com/tools/poimarker?type=0&marker=${points
          // 最多 4 个点
          .slice(0, 4)
          .map(
            ({ loc, name = "位置", detail = "详情" }) =>
              `coord:${loc};title:${encodeURIComponent(name)};addr:${encodeURIComponent(detail)}`,
          )
          .join("|")}&key=${generatorConfig.mapKey}&referer=inNENU)\n\n`;
      }

      case "img": {
        const { src, desc: imgDesc } = component;
        const imgLink = getFileLink(src);

        return `![${imgDesc ?? ""}](${imgLink})\n\n`;
      }

      case "carousel": {
        return `${component.images.map((link) => `![''](${getFileLink(link)})\n\n`).join("\n")}\n\n`;
      }

      case "doc": {
        const { name, url } = component;
        const docUrl = getFileLink(url);
        // oxlint-disable-next-line typescript/no-non-null-assertion
        const docName = `${name}.${url.split(".").pop()!}`;

        return `- [${docName}](${docUrl})\n\n`;
      }

      case "table": {
        return getTableMarkdown(component, componentLocation);
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

        return `\
#### ${header || `${lName}${fName} 联系方式`}

- 姓名: ${lName}${fName}
- 电话: [${num}](tel:${num})
${workNum ? `- 工作电话: ${workNum}\n` : ""}\
${hostNum ? `- 公司电话: ${hostNum}\n` : ""}\
${homeNum ? `- 家庭电话: ${homeNum}\n` : ""}\
${site ? `- 网站: <${site}>\n` : ""}\
${mail ? `- 邮箱: [${mail}](mailto:${mail})\n` : ""}\
${org ? `- 组织: ${org}\n` : ""}\
${contactTitle ? `- 职位: ${contactTitle}\n` : ""}\
${nick ? `- 昵称: ${nick}\n` : ""}\
${remark ? `- 备注: ${remark}\n` : ""}\
${province || city || street ? `- 地址: ${province}${city}${street}\n` : ""}\
${postCode ? `- 邮编: ${postCode}\n` : ""}\

`;
      }

      case "action": {
        return getActionMarkdown(component, componentLocation, {
          mode,
          urlConverter: options.urlConverter,
        });
      }

      case "account": {
        const { name, detail, desc: accountDesc, logo, qq, wxid, site, mail } = component;

        return `\
${logo ? `![${name}](${getFileLink(logo)})\n\n` : ""}\
${name ? `- 名称: ${name}\n` : ""}\
${detail ? `- 详情: ${detail}\n` : ""}\
${accountDesc ? `- 描述: ${accountDesc}\n` : ""}\
${qq ? `- QQ: ${qq}\n` : ""}\
${wxid ? `- 微信公众号二维码: ![](https://open.weixin.qq.com/qr/code?username=${wxid})\n` : ""}\
${site ? `- 网站: <${site}>\n` : ""}\
${mail ? `- 邮箱: [${mail}](mailto:${mail})\n` : ""}\

`;
      }

      case "audio": {
        const { src, name } = component;
        const audioLink = getFileLink(src);

        return `[音频${name ? `: ${name}` : ""}](${audioLink})\n\n`;
      }

      case "video": {
        const { src, title: videoTitle } = component;
        const videoLink = getFileLink(src);

        return `[视频${videoTitle ? `: ${videoTitle}` : ""}](${videoLink})\n\n`;
      }

      default: {
        return "";
      }
    }
  })
  .join("")}
`.trim();
  } catch (err) {
    throw new Error(`${pagePath} page.content 处理失败: ${(err as Error).message}`, { cause: err });
  }
};
