import { getAccountMarkdown } from "./components/account/markdown.js";
import { getActionMarkdown } from "./components/action/markdown.js";
import { getAudioMarkdown } from "./components/audio/markdown.js";
import { getCardMarkdown } from "./components/card/markdown.js";
import { getDocMarkdown } from "./components/doc/markdown.js";
import { getGridMarkdown } from "./components/grid/markdown.js";
import { getImgMarkdown } from "./components/img/markdown.js";
import { getListMarkdown } from "./components/list/markdown.js";
import { getLocationMarkdown } from "./components/location/markdown.js";
import type { PageConfig } from "./components/page.js";
import { getPhoneMarkdown } from "./components/phone/markdown.js";
import { getTableMarkdown } from "./components/table/markdown.js";
import { getTextMarkdown } from "./components/text/markdown.js";
import { getTitleMarkdown } from "./components/title/markdown.js";
import { getVideoMarkdown } from "./components/video/markdown.js";
import { getYamlValue } from "./helpers/index.js";
import { getIconLink } from "./utils.js";

/**
 * 生成页面 Markdown
 *
 * @param page 页面数据
 * @param pagePath 页面路径
 *
 * @returns Markdown 内容
 */
export const getPageMarkdown = (page: PageConfig, pagePath = ""): string => {
  if (!page) throw new Error(`${pagePath} doesn't contain anything`);

  if (!page.content)
    throw new Error(`${pagePath}.content doesn't contain anything`);

  const { title, icon, author, desc, cite, content: pageContents, time } = page;

  let content = "";

  content += `\
---
title: ${getYamlValue(title)}
`;

  if (icon) {
    const iconLink = getIconLink(icon);

    if (iconLink)
      content += `\
icon: ${iconLink}
`;
  }

  if (Array.isArray(author))
    content += `\
author:
${author.map((author) => `  - ${getYamlValue(author)}`).join("\n")}
`;
  else if (author)
    content += `\
author: ${getYamlValue(author)}
`;

  if (time)
    content += `\
date: ${time.toISOString()}
`;

  if (!cite)
    content += `\
isOriginal: true
`;

  content += `\
---

`;

  pageContents.forEach((component) => {
    const { env, tag } = component;

    if (!env || env.includes("web")) {
      // 处理图片
      if (tag === "img") content += getImgMarkdown(component);
      // 设置标题
      else if (tag === "title") content += getTitleMarkdown(component);
      // 设置文字
      else if (tag === "text" || tag === "p" || tag === "ul" || tag === "ol")
        content += getTextMarkdown(component);
      // 设置列表组件
      else if (tag === "list" || tag === "functional-list")
        content += getListMarkdown(component);
      // 设置网格组件
      else if (tag === "grid") content += getGridMarkdown(component);
      // 检测文档
      else if (tag === "doc") content += getDocMarkdown(component);
      // 设置电话
      else if (tag === "phone") content += getPhoneMarkdown(component);
      // 检测音频
      else if (tag === "card") content += getCardMarkdown(component);
      // 检测音频
      else if (tag === "audio") content += getAudioMarkdown(component);
      // 检测视频
      else if (tag === "video") content += getVideoMarkdown(component);
      // 检测动作
      else if (tag === "action") content += getActionMarkdown(component);
      // 检测账号
      else if (tag === "account") content += getAccountMarkdown(component);
      // 检测地点
      else if (tag === "location") content += getLocationMarkdown(component);
      // 表格
      else if (tag === "table") content += getTableMarkdown(component);
    }
  });

  if (desc ?? cite)
    content += `\
${
  desc
    ?.split("\n")
    .map((line) => `> ${line}`)
    .join("\n>\n") ?? ""
}\

${
  Array.isArray(cite)
    ? cite.length > 1
      ? `\
> 相关链接:
>
${cite.map((line, index) => `> [相关链接${index + 1}](${line})`).join("\n>\n")}
`
      : `\
> [相关链接](${cite[0]})
`
    : cite
      ? `\
> [相关链接](${cite})
`
      : ""
}
`;

  return content;
};
