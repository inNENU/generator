import * as zod from "zod";

const chineseErrorMap = zod.locales.zhCN().localeError as unknown as (
  issue: zod.core.$ZodIssue,
) => string | { message: string } | undefined;

/** Zod 在未提供定制文案时使用的默认消息 */
const genericMessages = new Set(["Invalid input", "无效输入"]);

/**
 * 判断消息是否比 zod 的默认文案更具体
 *
 * @param message 待判断的消息
 * @returns 是否为调用方显式给出的文案
 */
const isSpecificMessage = (message: string | undefined): message is string =>
  typeof message === "string" && message.length > 0 && !genericMessages.has(message);

/**
 * 拼接错误定位
 *
 * @param message 错误消息
 * @param path 错误位置
 * @returns 带位置信息的消息
 */
const withLocation = (message: string, path: readonly PropertyKey[]): string =>
  path.length > 0 ? `${message}（位置: ${path.join(".")}）` : message;

/**
 * 将 issue 映射为中文消息
 *
 * @param issue Zod 校验问题
 * @returns 中文问题描述
 */
const localizeIssue = (issue: zod.core.$ZodIssue): string => {
  const result = chineseErrorMap(issue);

  return typeof result === "string" ? result : (result?.message ?? issue.message);
};

/**
 * 收集 issue 中调用方显式给出的具体错误
 *
 * `invalid_union` 会递归展开各分支并保留分支定位；只收集 `custom` issue 与联合类型自带的定制消息，避免把 zod 的通用
 * 分支文案（如“无效URL”）全部拼接进来。返回的消息已包含位置信息。
 *
 * @param issue Zod 校验问题
 * @param parentPath 父级定位
 * @returns 具体错误描述列表
 */
const collectIssueMessages = (
  issue: zod.core.$ZodIssue,
  parentPath: readonly PropertyKey[],
): string[] => {
  const path = [...parentPath, ...(issue.path ?? [])];

  if (issue.code === "invalid_union") {
    // 判别字段不匹配时 zod 不提供分支错误，只有英文的判别值提示，此时退回 zhCN 文案
    if (issue.errors.length > 0 && isSpecificMessage(issue.message))
      return [withLocation(issue.message, path)];

    return issue.errors.flatMap((branchIssues) =>
      branchIssues.flatMap((branchIssue) => collectIssueMessages(branchIssue, path)),
    );
  }

  if (issue.code === "custom" && isSpecificMessage(issue.message))
    return [withLocation(issue.message, path)];

  return [];
};

/**
 * 将 zod issue 格式化为中文消息
 *
 * @param issue Zod 校验问题
 * @returns 中文问题描述
 */
const formatZodIssue = (issue: zod.core.$ZodIssue): string => {
  const path = issue.path ?? [];

  if (issue.code === "custom") {
    const message = isSpecificMessage(issue.message) ? issue.message : localizeIssue(issue);

    return withLocation(message, path);
  }

  if (issue.code === "invalid_union") {
    const messages = [...new Set(collectIssueMessages(issue, []))];

    return messages.length > 0 ? messages.join("；") : withLocation(localizeIssue(issue), path);
  }

  return withLocation(localizeIssue(issue), path);
};

/**
 * 将 zod 校验错误格式化为中文文本
 *
 * @param error Zod 校验错误
 * @returns 中文错误描述
 */
export const formatZodError = (error: zod.ZodError): string =>
  error.issues.map((issue) => `✖ ${formatZodIssue(issue)}`).join("\n");

/**
 * 校验错误
 *
 * 当数据未通过完整性校验时抛出，`issues` 中包含全部校验问题。
 */
export class ValidationError extends Error {
  /** 全部校验问题 */
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(`${message}:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * 输出 zod 校验错误并返回带定位的问题描述
 *
 * @param location 数据所在位置
 * @param label 错误提示
 * @param error Zod 校验错误
 * @returns 问题描述列表
 */
export const collectZodIssues = (
  location: string,
  label: string,
  error: zod.ZodError,
): string[] => {
  const detail = formatZodError(error);

  console.error(`${location} ${label}:`, detail);

  return [`${location} ${label}: ${detail}`];
};
