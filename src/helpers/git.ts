// oxlint-disable node/no-process-env
import { execSync } from "node:child_process";

/**
 * 获取当前分支名
 *
 * @returns 当前分支名
 */
export const getCurrentBranch = (): string =>
  execSync("git branch --show-current").toString().trim();

export interface ChangedFilesInfo {
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * 获取当前变更的文件列表
 *
 * @returns 变更的文件路径列表
 */
export const getCurrentChangedFiles = (): string[] => {
  const output = execSync(`git diff --name-only HEAD`).toString().trim();

  return output ? output.split("\n") : [];
};

/**
 * 获取最近一次提交（或 push 区间）变更的文件
 *
 * - 默认比较 HEAD 与其父提交（含首提交 --root）。
 * - 若传入 before/after，或 CI 环境存在 GITHUB_EVENT_BEFORE/AFTER， 则改用 `git diff --name-status before..after`
 *   计算变更集，一次覆盖 多 commit push、merge 提交与 force-push，避免只看最后一个提交导致的 图片/文件漏同步到 OSS。
 *
 * @param before 起始提交（可选；缺省时读取 GITHUB_EVENT_BEFORE）
 * @param after 结束提交（可选；缺省时读取 GITHUB_EVENT_AFTER）
 * @returns 变更的文件信息，包含新增、修改和删除的文件
 */
export const getLastChangedFiles = (before?: string, after?: string): ChangedFilesInfo => {
  const from = before ?? process.env.GITHUB_EVENT_BEFORE;
  const to = after ?? process.env.GITHUB_EVENT_AFTER;

  // CI 环境且提供了有效起始提交时，使用 push 事件区间计算变更集
  const result =
    from && to && !/^0+$/u.test(from)
      ? execSync(`git diff --no-renames --name-status ${from}..${to}`).toString()
      : execSync("git diff-tree --no-commit-id --name-status -r --root HEAD").toString();

  const lines = result.trim().split("\n");

  // 为每种文件变更类型初始化数组
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // 逐行处理结果
  lines.forEach((line) => {
    const [status, filePath] = line.split("\t");

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
        break;
      }
    }
  });

  return {
    added,
    modified,
    deleted,
  };
};
