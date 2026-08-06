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
 * 获取最近一次提交变更的文件
 *
 * @returns 变更的文件信息，包含新增、修改和删除的文件
 */
export const getLastChangedFiles = (): ChangedFilesInfo => {
  // 执行 git diff-tree 命令
  const result = execSync(`git diff-tree --no-commit-id --name-status -r HEAD`).toString().trim();

  const lines = result.split("\n");

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
      case "M": {
        modified.push(filePath);
        break;
      }
      case "D": {
        deleted.push(filePath);
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
