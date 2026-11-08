import * as zod from "zod";

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
  const detail = zod.prettifyError(error);

  console.error(`${location} ${label}:`, detail);

  return [`${location} ${label}: ${detail}`];
};
