import { getYamlValue } from "../helpers/index.js";
import type { MarkdownOptions } from "../typings.js";
import { getIconLink } from "../utils.js";
import { renderComponentMarkdown } from "./markdown-renderers.js";
import type { PageConfig } from "./schema.js";

/**
 * 生成页面 Markdown
 *
 * @param page 页面数据
 * @param options 生成选项
 * @returns Markdown 内容
 */
export const getPageMarkdown = (page: PageConfig, options: MarkdownOptions = {}): string => {
  const { location = "" } = options;

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

    pageContents.forEach((component, index) => {
      const componentLocation = `${location} page.content[${index}]`;
      const block = renderComponentMarkdown(component, {
        ...options,
        location: componentLocation,
      });

      if (block) blocks.push(block);
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
