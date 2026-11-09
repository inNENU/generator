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
 * 将页面描述渲染为引用块
 *
 * 多行描述逐行加 `> `，行间以空引用行（`\n>\n`）分隔，与站点管线保持一致； 空行保留为空引用行，行内首尾空白不做裁剪。
 *
 * @param desc 页面描述
 * @returns 引用格式的描述块（块后空行由调用方补充）
 */
const formatDesc = (desc: string): string => {
  const [firstLine = "", ...continuationLines] = escapeHtml(desc).split("\n");

  return [`描述: ${firstLine}`, ...continuationLines].map((line) => `> ${line}`).join("\n>\n");
};

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
  if (!page) throw new Error(`${pagePath} 页面数据不存在`);

  // 缺 content 属页面结构问题：check=false 时直接抛出精确文案；check=true 交给下面的内容校验汇总
  if (!options.check && !page.content) throw new Error(`${pagePath} 页面缺少可渲染内容`);

  /**
   * 当前处理阶段
   *
   * 配置级（标题、描述等页面字段）与内容级（组件渲染）异常分别使用不同的中文文案，避免把配置问题误报为内容问题。
   */
  let phase: "config" | "content" = "content";

  try {
    if (options.check) {
      runValidation(`${pagePath} 页面校验失败`, () => {
        const configIssues = checkPageConfig(page, pagePath);
        const contentIssues = checkPageContent(page.content, pagePath, pagePath);
        const issues = [...configIssues, ...contentIssues];

        if (issues.length) {
          // 保持一次性汇总全部问题的既有行为，仅按问题来源细化文案：
          // 内容问题优先，避免页面内容损坏时因配置 schema 同时报出 content 字段问题而误标为配置失败
          const label = contentIssues.length > 0 ? "页面内容校验失败" : "页面配置校验失败";

          throw new ValidationError(`${pagePath} ${label}`, issues);
        }
      });
    }

    phase = "config";

    const { title, desc, content } = page;
    const heading = `# ${escapeHtml(title)}`;
    const descBlock = desc ? `${formatDesc(desc)}\n\n` : "";

    phase = "content";

    const mode = options.mode ?? "web";

    // 不输出 cite：AI 无网络搜索能力，来源只能是小程序页面，不引用外部网址

    const body = content
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
      .join("\n\n");

    return `${heading}\n\n${descBlock}${body}`.trim();
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    const label = phase === "config" ? "页面配置处理失败" : "页面内容处理失败";

    throw new Error(`${pagePath} ${label}: ${(err as Error).message}`, { cause: err });
  }
};
