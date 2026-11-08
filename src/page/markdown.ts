import { getYamlValue } from "../helpers/index.js";
import { ValidationError, runValidation } from "../helpers/validation.js";
import type { MarkdownOptions } from "../typings.js";
import { getIconLink } from "../utils.js";
import { renderComponentMarkdown } from "./markdown-renderers.js";
import type { PageConfig } from "./schema.js";
import { checkPageConfig, checkPageContent } from "./schema.js";

export interface PageMarkdownOptions extends MarkdownOptions {
  /**
   * 是否进行完整性校验
   *
   * 为 `true` 时依次运行 `checkPageConfig` 与 `checkPageContent`，并把全部中文校验问题汇总后抛出 `ValidationError`；为
   * `false` 时不校验，保持宽松的生成行为。
   *
   * @default false
   */
  check?: boolean;
}

/**
 * 生成页面 Markdown
 *
 * @param page 页面数据
 * @param options 生成选项
 * @returns Markdown 内容
 */
export const getPageMarkdown = (page: PageConfig, options: PageMarkdownOptions = {}): string => {
  const { location = "", check = false } = options;

  if (!page) throw new Error(`${location} doesn't contain anything`);

  try {
    if (check) {
      runValidation(`${location} 页面校验失败`, () => {
        const issues = [
          ...checkPageConfig(page, location),
          ...checkPageContent(page.content, location, location),
        ];

        if (issues.length) throw new ValidationError(`${location} 页面校验失败`, issues);
      });
    }

    if (!page.content) throw new Error(`${location} page content doesn't contain anything`);

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
    if (err instanceof ValidationError) throw err;

    throw new Error(`为 ${location} 生成 Markdown 失败: ${(err as Error).message}`, { cause: err });
  }
};
