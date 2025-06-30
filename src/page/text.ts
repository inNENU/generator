import { getActionMarkdown } from "../components/action/markdown.js";
import { getTableMarkdown } from "../components/table/markdown.js";
import { _config } from "../config.js";
import type { PageConfig } from "../typings.js";
import { getFileLink } from "../utils.js";

export const getPageText = (page: PageConfig, pagePath = ""): string => {
  try {
    if (!page) throw new Error(`${pagePath} doesn't contain anything`);

    if (!page.content)
      throw new Error(`${pagePath}.content doesn't contain anything`);

    const { title, desc, cite, content } = page;

    return `\
# ${title}

${desc ? `> 描述: ${desc}\n\n` : ""}\
${cite ? `${["**引用来源**", ...(typeof cite === "string" ? [cite] : cite).map((line) => `- <${line}>`)].map((line) => `> ${line}`).join("\n")}\n\n` : ""}\
${content
  .map((component) => {
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

        const content = `${component.header ? `### ${component.header}\n\n` : ""}${texts.join("\n\n")}`;

        return content ? `${content}\n\n` : "";
      }

      case "ul": {
        const texts = Array.isArray(component.text)
          ? component.text
          : component.text
            ? [component.text]
            : [];

        const content = `${component.header ? `### ${component.header}\n\n` : ""}${texts.map((item) => `- ${item}`).join("\n\n")}`;

        return content ? `${content}\n\n` : "";
      }

      case "ol": {
        const texts = Array.isArray(component.text)
          ? component.text
          : component.text
            ? [component.text]
            : [];

        const content = `${component.header ? `### ${component.header}\n\n` : ""}${texts.map((item) => `1. ${item}`).join("\n\n")}`;

        return content ? `${content}\n\n` : "";
      }

      case "grid":
      case "list": {
        const { header, items = [], footer } = component;

        return `\
${header ? `#### ${header}\n\n` : ""}\
${items.map((item) => `- ${item.text}${"desc" in item && item.desc ? ` - ${item.desc}` : ""}`).join("\n")}

${footer ? `> ${footer}\n\n` : ""}\
`;
      }

      case "location": {
        const { header, points = [] } = component;

        return `\
${header ? `#### ${header}位置\n\n` : ""}\
![在腾讯地图中查看](https://apis.map.qq.com/tools/poimarker?type=0&marker=${points
          // maximum 4 points
          .slice(0, 4)
          .map(
            ({ loc, name = "位置", detail = "详情" }) =>
              `coord:${loc};title:${encodeURIComponent(
                name,
              )};addr:${encodeURIComponent(detail)}`,
          )
          .join("|")}&key=${_config.mapKey}&referer=inNENU)\n\n`;
      }

      case "img": {
        const { src, desc } = component;
        const imgLink = getFileLink(src);

        return `![${desc ?? ""}](${imgLink})\n\n`;
      }

      case "carousel": {
        return `${component.images.map((link) => `![''](${getFileLink(link)})\n\n`).join("\n")}\n\n`;
      }

      case "doc": {
        const { name, url } = component;
        const docUrl = getFileLink(url);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const docName = `${name}.${url.split(".").pop()!}`;

        return `- [${docName}](${docUrl})\n\n`;
      }

      case "table": {
        return getTableMarkdown(component);
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
          title,
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
${title ? `- 职位: ${title}\n` : ""}\
${nick ? `- 昵称: ${nick}\n` : ""}\
${remark ? `- 备注: ${remark}\n` : ""}\
${province || city || street ? `- 地址: ${province}${city}${street}\n` : ""}\
${postCode ? `- 邮编: ${postCode}\n` : ""}\

`;
      }

      case "action": {
        return getActionMarkdown(component);
      }

      case "account": {
        const { name, detail, desc, logo, qq, wxid, site, mail } = component;

        return `\
${logo ? `![${name}](${getFileLink(logo)})\n\n` : ""}\
${name ? `- 名称: ${name}\n` : ""}\
${detail ? `- 详情: ${detail}\n` : ""}\
${desc ? `- 描述: ${desc}\n` : ""}\
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
        const { src, title } = component;
        const videoLink = getFileLink(src);

        return `[视频${title ? `: ${title}` : ""}](${videoLink})\n\n`;
      }

      default:
        return "";
    }
  })
  .join("")}
`.trim();
  } catch (error) {
    throw new Error(
      `${pagePath} page.content 处理失败: ${(error as Error).message}`,
    );
  }
};
