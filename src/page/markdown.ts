// oxlint-disable import/max-dependencies
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
import type { MarkdownOptions, UrlHandler } from "../typings.js";
import { getIconLink } from "../utils.js";
import type { PageConfig } from "./schema.js";

/**
 * 生成页面 Markdown
 *
 * @param page 页面数据
 * @param options 生成选项
 * @returns Markdown 内容
 */
export const getPageMarkdown = (page: PageConfig, options: MarkdownOptions = {}): string => {
  const { location = "", urlConverter = (): ReturnType<UrlHandler> => null } = options;

  if (!page) throw new Error(`${location} doesn't contain anything`);

  if (!page.content) throw new Error(`${location} page content doesn't contain anything`);

  try {
    const { title, icon, author, desc, cite, content: pageContents, time } = page;

    let frontmatter = `\
---
title: ${getYamlValue(title)}
`;

    if (icon) {
      const iconLink = getIconLink(icon);

      if (iconLink) {
        frontmatter += `\
icon: ${iconLink}
`;
      }
    }

    if (Array.isArray(author)) {
      frontmatter += `\
author:
${author.map((item) => `  - ${getYamlValue(item)}`).join("\n")}
`;
    } else if (author) {
      frontmatter += `\
author: ${getYamlValue(author)}
`;
    }

    if (time) {
      frontmatter += `\
date: ${time}
`;
    }

    if (cite) {
      frontmatter += Array.isArray(cite)
        ? `\
cite:
${cite.map((item) => `  - ${getYamlValue(item)}`).join("\n")}
`
        : `\
cite:
  - ${getYamlValue(cite)}
`;
    } else {
      frontmatter += `\
isOriginal: true
`;
    }

    frontmatter += `\
---
`;

    const blocks: string[] = [];

    // oxlint-disable-next-line complexity
    pageContents.forEach((component, index) => {
      const { env, tag } = component;
      const componentLocation = `${location} page.content[${index}]`;

      if (!env || env.includes("web")) {
        // 处理图片
        if (tag === "img") blocks.push(getImgMarkdown(component, componentLocation));
        // 设置标题
        else if (tag === "title") blocks.push(getTitleMarkdown(component, componentLocation));
        // 设置文字
        else if (tag === "text" || tag === "p" || tag === "ul" || tag === "ol")
          blocks.push(getTextMarkdown(component, componentLocation));
        // 设置列表组件
        else if (tag === "list" || tag === "functional-list")
          blocks.push(getListMarkdown(component, { location: componentLocation, urlConverter }));
        // 设置网格组件
        else if (tag === "grid")
          blocks.push(getGridMarkdown(component, { location: componentLocation, urlConverter }));
        // 检测文档
        else if (tag === "doc") blocks.push(getDocMarkdown(component, componentLocation));
        // 设置电话
        else if (tag === "phone") blocks.push(getPhoneMarkdown(component, componentLocation));
        // 检测音频
        else if (tag === "card")
          blocks.push(getCardMarkdown(component, { location: componentLocation, urlConverter }));
        // 检测音频
        else if (tag === "audio") blocks.push(getAudioMarkdown(component, componentLocation));
        // 检测视频
        else if (tag === "video") blocks.push(getVideoMarkdown(component, componentLocation));
        // 检测动作
        else if (tag === "action") blocks.push(getActionMarkdown(component, componentLocation));
        // 检测账号
        else if (tag === "account") blocks.push(getAccountMarkdown(component, componentLocation));
        // 检测地点
        else if (tag === "location") blocks.push(getLocationMarkdown(component, componentLocation));
        // 表格
        else if (tag === "table") blocks.push(getTableMarkdown(component, componentLocation));
      }
    });

    if (desc) {
      blocks.push(
        desc
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n>\n"),
      );
    }

    // 组件模板自身可能以换行开头，统一去掉后再按一个空行拼接，
    // 避免 card 的 `<a>` / `<RouteLink>` 等 HTML block 把后续组件吞进去。
    const body = blocks
      .map((block) => block.replace(/^\n+/u, "").trimEnd())
      .filter((block) => block !== "")
      .join("\n\n");

    // 没有可渲染组件（或均被 env 过滤）时，保留 frontmatter 后的空行
    return body ? `${frontmatter}\n${body}\n` : `${frontmatter}\n`;
  } catch (err) {
    throw new Error(`为 ${location} 生成 Markdown 失败: ${(err as Error).message}`, { cause: err });
  }
};
