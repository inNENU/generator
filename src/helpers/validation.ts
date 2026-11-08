import * as zod from "zod";

const chineseErrorMap = zod.locales.zhCN().localeError as unknown as (
  issue: zod.core.$ZodIssue,
) => string | { message: string } | undefined;

/**
 * 将 zod issue 格式化为中文消息
 *
 * @param issue Zod 校验问题
 * @returns 中文问题描述
 */
const formatZodIssue = (issue: zod.core.$ZodIssue): string => {
  const result = chineseErrorMap(issue);
  const message = typeof result === "string" ? result : (result?.message ?? issue.message);
  const path = issue.path ?? [];

  return path.length > 0 ? `${message}（位置: ${path.join(".")}）` : message;
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
