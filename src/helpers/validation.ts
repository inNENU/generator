import * as zod from "zod";

type ZodIssue = zod.core.$ZodIssue;

const chineseErrorMap = zod.locales.zhCN().localeError as unknown as (
  issue: ZodIssue,
) => string | { message: string } | undefined;

const englishErrorMap = zod.locales.en().localeError as unknown as (
  issue: ZodIssue,
) => string | { message: string } | undefined;

/** Zod 在未提供定制文案时使用的通用消息 */
const genericMessages = new Set(["Invalid input", "无效输入"]);

/**
 * Zod 内置文案的开头
 *
 * 调用方显式给出的文案通常不会以这些片段开头；命中时视为 zod 默认文案，避免把英文/中文默认提示当成作者自定义消息。
 */
const defaultMessagePrefixes = [
  "Invalid input",
  "Invalid value",
  "Invalid option",
  "Invalid key",
  "Invalid union",
  "Invalid element",
  "Invalid length",
  "Invalid discriminator",
  "Unrecognized key",
  "Too small",
  "Too big",
  "Not multiple of",
  "无效输入",
  "无效值",
  "无效选项",
  "无效键",
  "无效联合",
  "无效元素",
  "无效长度",
  "数值过小",
  "数值过大",
  "无法识别的键",
];

/** 联合类型最多展示的问题条数，避免一次校验输出过多内容 */
const maxUnionMessages = 5;

/** 联合类型展开的最大深度，防御异常结构导致的递归失控 */
const maxUnionDepth = 4;

/** 展开过程中最多收集的原始问题条数 */
const maxCollectedMessages = 50;

/**
 * 归一化消息中随输入变化的部分
 *
 * Zod 的 issue 在离开解析流程后不再保留 `input`，直接调用 error map 会把“实际接收 number”重算成“实际接收 undefined”。
 * 比较默认文案时忽略该片段，避免把 `invalid_type` 误判为作者自定义消息。
 *
 * @param message 待归一化的消息
 * @returns 归一化后的消息
 */
const normalizeMessage = (message: string): string =>
  message
    .replaceAll(/received\s+[^,;.\n]+/gu, "received <value>")
    .replaceAll(/实际接收\s*[^,，;；。\n]+/gu, "实际接收 <value>");

/**
 * 读取 error map 的文案
 *
 * @param errorMap Zod error map
 * @param issue Zod 校验问题
 * @returns 文案，无法生成时为 `undefined`
 */
const readErrorMessage = (
  errorMap: (issue: ZodIssue) => string | { message: string } | undefined,
  issue: ZodIssue,
): string | undefined => {
  const result = errorMap(issue);

  return typeof result === "string" ? result : result?.message;
};

/**
 * 将 issue 映射为中文消息
 *
 * @param issue Zod 校验问题
 * @returns 中文问题描述
 */
const localizeIssue = (issue: ZodIssue): string =>
  readErrorMessage(chineseErrorMap, issue) ?? issue.message;

/**
 * 判断消息是否来自 zod 的默认文案
 *
 * 依次比对通用文案、内置文案开头，以及与 en/zhCN error map 生成结果的归一化文本；三者都不匹配时认为是调用方显式给出的文案。
 *
 * @param issue Zod 校验问题
 * @returns 是否为 zod 默认文案
 */
const isDefaultMessage = (issue: ZodIssue): boolean => {
  const { message } = issue;

  if (!message) return true;
  if (genericMessages.has(message)) return true;
  if (defaultMessagePrefixes.some((prefix) => message.startsWith(prefix))) return true;

  const normalized = normalizeMessage(message);

  return [englishErrorMap, chineseErrorMap].some((errorMap) => {
    const localized = readErrorMessage(errorMap, issue);

    return typeof localized === "string" && normalizeMessage(localized) === normalized;
  });
};

/**
 * 解析单条 issue 的最终消息
 *
 * 作者显式给出的文案优先于 zhCN locale 生成的默认文案，例如 `.min(1, "页面标题不能为空")` 这类通过参数传入的消息。
 *
 * @param issue Zod 校验问题
 * @returns 问题描述（不含位置）
 */
const resolveIssueMessage = (issue: ZodIssue): string =>
  isDefaultMessage(issue) ? localizeIssue(issue) : issue.message;

/**
 * 拼接错误定位
 *
 * @param message 错误消息
 * @param path 错误位置
 * @returns 带位置信息的消息
 */
const withLocation = (message: string, path: readonly PropertyKey[]): string =>
  path.length > 0 ? `${message}（位置: ${path.join(".")}）` : message;

/** 展开后的问题，`author` 标记文案是否来自调用方 */
interface UnionIssueMessage {
  readonly text: string;
  readonly author: boolean;
}

/**
 * 描述判别值不匹配的联合类型问题
 *
 * Zod 不会为判别值不匹配提供分支错误，只给出英文的判别提示；这里转成列出合法取值的中文文案。
 *
 * @param issue 联合类型问题
 * @returns 可读描述，无法判断时退回 locale 文案
 */
const describeUnionMismatch = (issue: zod.core.$ZodIssueInvalidUnion): string => {
  // 判别值不匹配时 zod 会在 issue 上附带 discriminator 与 options，但类型定义未暴露这两个字段
  const { discriminator, options } = issue as {
    readonly discriminator?: PropertyKey;
    readonly options?: readonly PropertyKey[];
  };

  if (!discriminator || !options?.length) return localizeIssue(issue);

  return `无效的 ${String(discriminator)} 值，期望以下之一：${options.map(String).join(" | ")}`;
};

/**
 * 递归展开联合类型的分支问题
 *
 * 每层都会把当前 issue 的 path 追加到父级定位后，因此最终消息保留“外层位置 + 分支字段路径”（如 `0.title`）。
 *
 * @param issue 当前 issue
 * @param parentPath 父级定位
 * @param messages 收集结果
 * @param depth 当前展开深度
 */
const collectUnionMessages = (
  issue: ZodIssue,
  parentPath: readonly PropertyKey[],
  messages: UnionIssueMessage[],
  depth: number,
): void => {
  if (messages.length >= maxCollectedMessages) return;

  const path = [...parentPath, ...(issue.path ?? [])];

  if (issue.code === "invalid_union" && depth < maxUnionDepth) {
    if (issue.errors.length > 0) {
      for (const branch of issue.errors) {
        for (const branchIssue of branch)
          collectUnionMessages(branchIssue, path, messages, depth + 1);
      }

      return;
    }

    messages.push({
      text: withLocation(describeUnionMismatch(issue), path),
      author: false,
    });

    return;
  }

  const author = !isDefaultMessage(issue);

  messages.push({
    text: withLocation(author ? issue.message : localizeIssue(issue), path),
    author,
  });
};

/**
 * 将联合类型问题格式化为中文消息
 *
 * 联合类型自身带有作者文案时直接使用；否则展开各分支，作者显式给出的分支文案排在前面，相同文案与定位会去重， 超过上限时截断并注明剩余条数。
 *
 * @param issue 联合类型问题
 * @returns 中文问题描述
 */
const formatUnionIssue = (issue: zod.core.$ZodIssueInvalidUnion): string => {
  const path = issue.path ?? [];

  // 联合类型自身带有作者文案时（如 `imgSchema` 的 `error` 回调、判别值不匹配的定制提示），该文案已汇总分支信息，直接使用
  if (!isDefaultMessage(issue)) return withLocation(issue.message, path);

  const collected: UnionIssueMessage[] = [];

  collectUnionMessages(issue, [], collected, 0);

  const seen = new Set<string>();
  const unique = collected.filter(({ text }) => {
    if (seen.has(text)) return false;

    seen.add(text);

    return true;
  });
  const ordered = [
    ...unique.filter(({ author }) => author),
    ...unique.filter(({ author }) => !author),
  ];
  const shown = ordered.slice(0, maxUnionMessages);
  const hidden = ordered.length - shown.length;

  if (hidden > 0) shown.push({ text: `其余 ${hidden} 条问题已省略`, author: false });

  return shown.length > 0
    ? shown.map(({ text }) => text).join("；")
    : withLocation(localizeIssue(issue), path);
};

/**
 * 将 zod issue 格式化为中文消息
 *
 * @param issue Zod 校验问题
 * @returns 中文问题描述
 */
const formatZodIssue = (issue: ZodIssue): string => {
  if (issue.code === "invalid_union") return formatUnionIssue(issue);

  return withLocation(resolveIssueMessage(issue), issue.path ?? []);
};

/**
 * 将 zod 校验错误格式化为中文文本
 *
 * @param error Zod 校验错误
 * @returns 中文错误描述
 * @internal
 */
export const formatZodError = (error: zod.ZodError): string =>
  error.issues.map((issue) => `✖ ${formatZodIssue(issue)}`).join("\n");

/**
 * 校验错误
 *
 * 当数据未通过完整性校验时抛出，`issues` 中包含全部校验问题。
 *
 * @internal
 */
export class ValidationError extends Error {
  /** 全部校验问题 */
  readonly issues: string[];

  constructor(message: string, issues: string[], options?: ErrorOptions) {
    super(`${message}:\n${issues.map((issue) => `- ${issue}`).join("\n")}`, options);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * 执行校验逻辑，并把校验过程中的意外异常包装为 `ValidationError`
 *
 * 校验函数正常返回问题数组时不会走到包装逻辑；只有校验实现本身抛出异常时，才保留原始异常为 `cause`， 保证调用方在 `check` 模式下只需要处理 `ValidationError`。
 *
 * @param message 校验失败消息
 * @param validate 校验回调，发现问题时应抛出 `ValidationError`
 * @internal
 */
export const runValidation = (message: string, validate: () => void): void => {
  try {
    validate();
  } catch (err) {
    if (err instanceof ValidationError) throw err;

    throw new ValidationError(message, [`校验时出现异常: ${(err as Error).message}`], {
      cause: err,
    });
  }
};

/**
 * 输出 zod 校验错误并返回带定位的问题描述
 *
 * @param location 数据所在位置
 * @param label 错误提示
 * @param error Zod 校验错误
 * @returns 问题描述列表
 * @internal
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
