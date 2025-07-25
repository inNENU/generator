import type { PageConfig } from "./schema.js";
import { getAccountMarkdown } from "../components/account/markdown.js";
import { getActionMarkdown } from "../components/action/markdown.js";
import { getAudioMarkdown } from "../components/audio/markdown.js";
import { getCardMarkdown } from "../components/card/markdown.js";
import { getDocMarkdown } from "../components/doc/markdown.js";
import { getGridMarkdown } from "../components/grid/markdown.js";
import { getImgMarkdown } from "../components/img/markdown.js";
import { getListMarkdown } from "../components/list/markdown.js";
import { getLocationMarkdown } from "../components/location/markdown.js";
import { getPhoneMarkdown } from "../components/phone/markdown.js";
import { getTableMarkdown } from "../components/table/markdown.js";
import { getTextMarkdown } from "../components/text/markdown.js";
import { getTitleMarkdown } from "../components/title/markdown.js";
import { getVideoMarkdown } from "../components/video/markdown.js";
import { getYamlValue } from "../helpers/index.js";
import { getIconLink } from "../utils.js";

/**
 * 生成页面 Markdown
 *
 * @param page 页面数据
 * @param location 页面位置
 *
 * @returns Markdown 内容
 */
export const getPageMarkdown = (page: PageConfig, location = ""): string => {
  if (!page) throw new Error(`${location} doesn't contain anything`);

  if (!page.content)
    throw new Error(`${location} page content doesn't contain anything`);

  try {
    const {
      title,
      icon,
      author,
      desc,
      cite,
      tags,
      content: pageContents,
      time,
    } = page;

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

    if (tags?.length)
      content += `\
tags:
${tags.map((tag) => `  - ${getYamlValue(tag)}`).join("\n")}
`;

    if (cite)
      content += Array.isArray(cite)
        ? `\
cite:
${cite.map((c) => `  - ${getYamlValue(c)}`).join("\n")}
`
        : `\
cite:
  - ${getYamlValue(cite)}
`;
    else
      content += `\
isOriginal: true
`;

    content += `\
---

`;

    pageContents.forEach((component, index) => {
      const { env, tag } = component;
      const componentLocation = `${location} page.content[${index}]`;

      if (!env || env.includes("web")) {
        // 处理图片
        if (tag === "img")
          content += getImgMarkdown(component, componentLocation);
        // 设置标题
        else if (tag === "title")
          content += getTitleMarkdown(component, componentLocation);
        // 设置文字
        else if (tag === "text" || tag === "p" || tag === "ul" || tag === "ol")
          content += getTextMarkdown(component, componentLocation);
        // 设置列表组件
        else if (tag === "list" || tag === "functional-list")
          content += getListMarkdown(component, componentLocation);
        // 设置网格组件
        else if (tag === "grid")
          content += getGridMarkdown(component, componentLocation);
        // 检测文档
        else if (tag === "doc")
          content += getDocMarkdown(component, componentLocation);
        // 设置电话
        else if (tag === "phone")
          content += getPhoneMarkdown(component, componentLocation);
        // 检测音频
        else if (tag === "card")
          content += getCardMarkdown(component, componentLocation);
        // 检测音频
        else if (tag === "audio")
          content += getAudioMarkdown(component, componentLocation);
        // 检测视频
        else if (tag === "video")
          content += getVideoMarkdown(component, componentLocation);
        // 检测动作
        else if (tag === "action")
          content += getActionMarkdown(component, componentLocation);
        // 检测账号
        else if (tag === "account")
          content += getAccountMarkdown(component, componentLocation);
        // 检测地点
        else if (tag === "location")
          content += getLocationMarkdown(component, componentLocation);
        // 表格
        else if (tag === "table")
          content += getTableMarkdown(component, componentLocation);
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
`;

    return content;
  } catch (error) {
    throw new Error(
      `为 ${location} 生成 Markdown 失败: ${(error as Error).message}`,
    );
  }
};
