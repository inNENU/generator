// oxlint-disable node/no-process-env
import { execFileSync } from "node:child_process";

/** 合法的提交引用：7-64 位十六进制 commit id 或 HEAD */
const COMMIT_REF_PATTERN = /^[0-9a-f]{7,64}$/iu;

/** 全 0 的提交引用（如 GitHub 新建分支时的 before） */
const ALL_ZERO_REF_PATTERN = /^0+$/u;

/**
 * 统一以参数数组方式调用 git，避免经过 shell 解析
 *
 * @param args Git 参数列表
 * @returns 命令输出
 */
const runGit = (args: string[]): string => execFileSync("git", args, { encoding: "utf-8" });

/**
 * 读取环境变量中的提交引用
 *
 * @param name 环境变量名
 * @returns 环境变量值；未设置或为空串时返回 null
 */
const readEnvRef = (name: string): string | null => {
  const value = process.env[name];

  if (!value) return null;

  return value;
};

/**
 * 校验 git 提交引用，避免非法值被拼入命令
 *
 * @param ref 提交引用
 * @param name 参数名，用于错误信息
 */
const assertValidRef = (ref: string, name: string): void => {
  if (ref.length === 0)
    throw new Error(`${name} 引用不能为空：只允许 7-64 位十六进制 commit id 或 "HEAD"`);

  if (ref === "HEAD" || COMMIT_REF_PATTERN.test(ref)) return;

  throw new Error(`无效的 ${name} 引用 "${ref}"：只允许 7-64 位十六进制 commit id 或 "HEAD"`);
};

/**
 * 获取当前分支名
 *
 * @returns 当前分支名
 * @internal
 */
export const getCurrentBranch = (): string => runGit(["branch", "--show-current"]).trim();

/** @internal */
export interface ChangedFilesInfo {
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * 获取当前变更的文件列表
 *
 * 路径按 `-z` 的 NUL 分隔原样解析：`--name-only` 默认会把 CJK 路径输出为带引号的八进制 转义串，按行切分只能拿到假路径；改用 NUL 分隔后文件名原样返回。
 *
 * @returns 变更的文件路径列表；无变更时返回空数组
 * @internal
 */
export const getCurrentChangedFiles = (): string[] => {
  const tokens = runGit(["diff", "--name-only", "-z", "HEAD"]).split("\0");

  // `--name-only -z` 的输出以 NUL 结尾，末尾会多出一个空串
  if (tokens.at(-1) === "") tokens.pop();

  return tokens;
};

/**
 * 获取最近一次提交（或 push 区间）变更的文件
 *
 * - 默认比较 HEAD 与其父提交（含首提交 --root）。
 * - 若传入 before/after，或 CI 环境存在 GITHUB_EVENT_BEFORE/AFTER， 则改用 `git diff --name-status before..after`
 *   计算变更集，一次覆盖 多 commit push、merge 提交与 force-push，避免只看最后一个提交导致的 图片/文件漏同步到 OSS。
 * - 路径按 `-z` 的 NUL 分隔原样解析，CJK、空格、制表符与换行文件名不会被转义或截断。
 * - 没有可用区间时回退到 `diff-tree HEAD`；Git 默认不输出合并提交的 combined diff，故合并提交返回空列表而不抛错。
 *
 * @param before 起始提交（可选；缺省时读取 GITHUB_EVENT_BEFORE）
 * @param after 结束提交（可选；缺省时读取 GITHUB_EVENT_AFTER）
 * @returns 变更的文件信息，包含新增、修改和删除的文件
 * @internal
 */
export const getLastChangedFiles = (before?: string, after?: string): ChangedFilesInfo => {
  // 环境变量为空时视为未提供（CI 中非 push 事件可能为空串），显式传入的空串则会被校验拒绝
  const from = before ?? readEnvRef("GITHUB_EVENT_BEFORE");
  const to = after ?? readEnvRef("GITHUB_EVENT_AFTER");

  if (from != null) assertValidRef(from, "from");
  if (to != null) assertValidRef(to, "to");

  // 统一使用 `-z`：状态与路径以 NUL 分隔，路径不做引号/八进制转义。
  // 这样 CJK、空格、制表符、换行等文件名都能原样解析，不受 core.quotePath 与按行切分的影响。
  // CI 环境且提供了有效起始提交时，使用 push 事件区间计算变更集
  const result =
    from != null && to != null && !ALL_ZERO_REF_PATTERN.test(from) && !ALL_ZERO_REF_PATTERN.test(to)
      ? runGit(["diff", "--no-renames", "--name-status", "-z", `${from}..${to}`])
      : runGit([
          "diff-tree",
          "--no-commit-id",
          "--no-renames",
          "--name-status",
          "-r",
          "--root",
          "-z",
          "HEAD",
        ]);

  // `--name-status -z` 的输出形如 `<状态>\0<路径>\0<状态>\0<路径>\0`，末尾多一个空串
  const tokens = result.split("\0");

  if (tokens.at(-1) === "") tokens.pop();
  if (tokens.length % 2 !== 0) throw new Error("无法解析 git 变更文件列表：状态与路径数量不匹配");

  // 为每种文件变更类型初始化数组
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // 逐对（状态、路径）处理结果
  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index];
    const filePath = tokens[index + 1];

    switch (status) {
      case "A": {
        added.push(filePath);
        break;
      }
      case "D": {
        deleted.push(filePath);
        break;
      }
      case "M":
      case "T": {
        modified.push(filePath);
        break;
      }
      default: {
        throw new Error(`无法识别的文件变更状态 "${status}"（文件: ${filePath}）`);
      }
    }
  }

  return {
    added,
    modified,
    deleted,
  };
};
