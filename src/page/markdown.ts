import { getYamlValue } from "../helpers/index.js";
import { sanitizeUrl } from "../helpers/url.js";
import { ValidationError } from "../helpers/validation.js";
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
 * 生成页面 frontmatter
 *
 * 空数组与缺省等价：`author: []`、`cite: []` 不输出只有键名的裸 YAML 键。
 *
 * `cite` 会逐条做 URL 协议校验，只保留 `sanitizeUrl` 允许的来源（站内相对地址、`http:`、`https:`、`mailto:`、`tel:`）， 危险协议（如
 * `javascript:`）与 HTML 字符引用混淆变体直接丢弃，避免站点主题把来源渲染成可点击的执行链接。语义约定：
 *
 * - 没有任何来源（`cite` 缺省或为空）：不输出 `cite`，输出 `isOriginal: true`；
 * - 存在来源但全部非法：不输出 `cite`，也不输出 `isOriginal`（页面并非原创，只是来源无法安全展示）；
 * - 存在合法来源：只输出合法来源，不输出 `isOriginal`。
 *
 * @param page 页面数据
 * @returns 含首尾 `---` 的 frontmatter 内容
 */
const buildFrontmatter = (page: PageConfig): string => {
  const { title, icon, author, cite, time } = page;

  let frontmatter = `\
---
title: ${getYamlValue(title)}
`;

  if (icon) {
    const iconLink = sanitizeUrl(getIconLink(icon));

    if (iconLink) {
      frontmatter += `\
icon: ${iconLink}
`;
    }
  }

  if (Array.isArray(author)) {
    if (author.length > 0) {
      frontmatter += `\
author:
${author.map((item) => `  - ${getYamlValue(item)}`).join("\n")}
`;
    }
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

  const rawCites = Array.isArray(cite) ? cite : cite ? [cite] : [];
  const cites = rawCites
    .map((item) => sanitizeUrl(item))
    .filter((item): item is string => Boolean(item));

  if (cites.length > 0) {
    frontmatter += `\
cite:
${cites.map((item) => `  - ${getYamlValue(item)}`).join("\n")}
`;
  } else if (rawCites.length === 0) {
    frontmatter += `\
isOriginal: true
`;
  }

  return `${frontmatter}---
`;
};

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

  if (!page.content) throw new Error(`${location} page content doesn't contain anything`);

  if (check) {
    const issues = [
      ...checkPageConfig(page, location),
      ...checkPageContent(page.content, location, location),
    ];

    if (issues.length) throw new ValidationError(`${location} 页面校验失败`, issues);
  }

  try {
    const { desc, content: pageContents } = page;
    const frontmatter = buildFrontmatter(page);

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
