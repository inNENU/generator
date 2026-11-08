import { ValidationError, runValidation } from "../helpers/validation.js";
import type { PageConfig } from "../typings.js";
import { escapeHtml } from "../utils.js";
import { renderComponentMarkdown } from "./markdown-renderers.js";
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

    if (options.check) {
      runValidation(`${pagePath} 页面校验失败`, () => {
        const issues = [
          ...checkPageConfig(page, pagePath),
          ...checkPageContent(page.content, pagePath, pagePath),
        ];

        if (issues.length) throw new ValidationError(`${pagePath} 页面校验失败`, issues);
      });
    }

    if (!page.content) throw new Error(`${pagePath}.content doesn't contain anything`);

    const { title, desc, content } = page;

    const mode = options.mode ?? "web";

    // 不输出 cite：AI 无网络搜索能力，来源只能是小程序页面，不引用外部网址

    return `\
# ${escapeHtml(title)}

${desc ? `> 描述: ${escapeHtml(desc)}\n\n` : ""}\
${content
  .map((component, index) =>
    renderComponentMarkdown(component, {
      dialect: "text",
      location: `${pagePath} page.content[${index}]`,
      mode,
      urlConverter: options.urlConverter,
    }),
  )
  .filter((block) => block !== "")
  // 组件块自身带有尾部空行，统一裁剪后再按一个空行拼接
  .map((block) => block.replace(/^\n+/u, "").trimEnd())
  .filter((block) => block !== "")
  .join("\n\n")}
`.trim();
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    throw new Error(`${pagePath} page.content 处理失败: ${(err as Error).message}`, { cause: err });
  }
};
