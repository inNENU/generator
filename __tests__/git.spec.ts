import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { getCurrentChangedFiles, getLastChangedFiles } from "../src/index.js";

/**
 * 在指定目录执行 git 命令
 *
 * @param cwd 工作目录
 * @param args Git 参数列表
 * @returns 命令输出
 */
const git = (cwd: string, args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf-8" });

interface TestRepo {
  dir: string;
  cleanup: () => void;
}

/**
 * 创建一个带一次提交的临时 git 仓库
 *
 * @returns 临时仓库目录及清理函数
 */
const createRepo = (): TestRepo => {
  const dir = mkdtempSync(path.join(tmpdir(), "innenu-git-"));

  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test User"]);
  git(dir, ["config", "commit.gpgsign", "false"]);

  writeFileSync(path.join(dir, "tracked.txt"), "v1\n");
  writeFileSync(path.join(dir, "deleted.txt"), "bye\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "initial"]);

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

/**
 * 在临时仓库中切换工作目录执行，结束后恢复
 *
 * @param dir 临时仓库目录
 * @param fn 在该目录下执行的回调
 * @returns 回调的返回值
 */
const withCwd = <T>(dir: string, fn: () => T): T => {
  const originalCwd = process.cwd();

  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(originalCwd);
  }
};

describe(getCurrentChangedFiles, () => {
  it("returns an empty list when the working tree has no changes", () => {
    const repo = createRepo();

    try {
      expect(withCwd(repo.dir, () => getCurrentChangedFiles())).toStrictEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("returns raw CJK, space and control characters in file names", () => {
    const repo = createRepo();

    try {
      // 回归：旧实现按行切分 `--name-only` 输出，CJK 路径被 core.quotePath 转义成
      // `"\344\270\255..."` 这样的带引号假路径，含制表符/换行的名称还会被拆成多行。
      const changedFiles = ["中文 页面.yml", "空格 名称.yml", "tab\tname.yml", "line\nbreak.yml"];

      changedFiles.forEach((fileName) => {
        writeFileSync(path.join(repo.dir, fileName), "content\n");
      });
      writeFileSync(path.join(repo.dir, "tracked.txt"), "v2\n");
      git(repo.dir, ["add", "-A"]);

      const result = withCwd(repo.dir, () => getCurrentChangedFiles());

      expect(result.toSorted()).toStrictEqual([...changedFiles, "tracked.txt"].toSorted());
    } finally {
      repo.cleanup();
    }
  });
});

describe(getLastChangedFiles, () => {
  it("rejects a ref containing shell metacharacters", () => {
    const repo = createRepo();

    try {
      expect(() =>
        withCwd(repo.dir, () => getLastChangedFiles("HEAD", "HEAD; echo INJECTED_MARKER")),
      ).toThrow(/无效的 to 引用 "HEAD; echo INJECTED_MARKER"/u);
    } finally {
      repo.cleanup();
    }
  });

  it("rejects an injected GITHUB_EVENT_AFTER value", () => {
    const repo = createRepo();
    const injected = "HEAD; echo INJECTED_MARKER";

    vi.stubEnv("GITHUB_EVENT_AFTER", injected);
    try {
      expect(() => withCwd(repo.dir, () => getLastChangedFiles("HEAD"))).toThrow(
        /HEAD; echo INJECTED_MARKER/u,
      );
    } finally {
      vi.unstubAllEnvs();

      repo.cleanup();
    }
  });

  it("rejects an empty ref", () => {
    expect(() => getLastChangedFiles("", "HEAD")).toThrow(/不能为空/u);
  });

  it("returns empty lists for an empty diff", () => {
    const repo = createRepo();

    try {
      expect(withCwd(repo.dir, () => getLastChangedFiles("HEAD", "HEAD"))).toStrictEqual({
        added: [],
        modified: [],
        deleted: [],
      });
    } finally {
      repo.cleanup();
    }
  });

  it("collects added, modified and deleted files from a commit range", () => {
    const repo = createRepo();

    try {
      writeFileSync(path.join(repo.dir, "added.txt"), "new\n");
      writeFileSync(path.join(repo.dir, "tracked.txt"), "v2\n");
      rmSync(path.join(repo.dir, "deleted.txt"));
      git(repo.dir, ["add", "-A"]);
      git(repo.dir, ["commit", "-m", "second"]);

      const firstCommit = git(repo.dir, ["rev-parse", "HEAD^"]).trim();
      const result = withCwd(repo.dir, () => getLastChangedFiles(firstCommit, "HEAD"));

      expect(result.added).toStrictEqual(["added.txt"]);
      expect(result.modified).toStrictEqual(["tracked.txt"]);
      expect(result.deleted).toStrictEqual(["deleted.txt"]);
    } finally {
      repo.cleanup();
    }
  });

  it("falls back to diff-tree when no refs are available", () => {
    const repo = createRepo();

    vi.stubEnv("GITHUB_EVENT_BEFORE", "");
    vi.stubEnv("GITHUB_EVENT_AFTER", "");
    try {
      const result = withCwd(repo.dir, () => getLastChangedFiles());

      expect(result.added.toSorted()).toStrictEqual(["deleted.txt", "tracked.txt"]);
      expect(result.modified).toStrictEqual([]);
      expect(result.deleted).toStrictEqual([]);
    } finally {
      vi.unstubAllEnvs();

      repo.cleanup();
    }
  });

  it("keeps CJK, space and control characters in file names", () => {
    const repo = createRepo();

    try {
      const addedFiles = [
        "中文 文件.txt",
        "空格 名称.txt",
        "tab\tname.txt",
        "line\nbreak.txt",
        'quote"name.txt',
      ];

      addedFiles.forEach((fileName) => {
        writeFileSync(path.join(repo.dir, fileName), "content\n");
      });
      writeFileSync(path.join(repo.dir, "tracked.txt"), "v2\n");
      rmSync(path.join(repo.dir, "deleted.txt"));
      git(repo.dir, ["add", "-A"]);
      git(repo.dir, ["commit", "-m", "special file names"]);

      const firstCommit = git(repo.dir, ["rev-parse", "HEAD^"]).trim();
      const result = withCwd(repo.dir, () => getLastChangedFiles(firstCommit, "HEAD"));

      expect(result.added.toSorted()).toStrictEqual(addedFiles.toSorted());
      expect(result.modified).toStrictEqual(["tracked.txt"]);
      expect(result.deleted).toStrictEqual(["deleted.txt"]);
    } finally {
      repo.cleanup();
    }
  });

  it("keeps CJK and control characters in file names when falling back to diff-tree", () => {
    const repo = createRepo();

    vi.stubEnv("GITHUB_EVENT_BEFORE", "");
    vi.stubEnv("GITHUB_EVENT_AFTER", "");
    try {
      const addedFiles = ["中文 图标.svg", "tab\tname.txt", "line\nbreak.txt"];

      addedFiles.forEach((fileName) => {
        writeFileSync(path.join(repo.dir, fileName), "content\n");
      });
      git(repo.dir, ["add", "-A"]);
      git(repo.dir, ["commit", "-m", "special file names"]);

      const result = withCwd(repo.dir, () => getLastChangedFiles());

      expect(result.added.toSorted()).toStrictEqual(addedFiles.toSorted());
    } finally {
      vi.unstubAllEnvs();

      repo.cleanup();
    }
  });

  it("returns an empty change set for a merge commit instead of throwing", () => {
    const repo = createRepo();

    vi.stubEnv("GITHUB_EVENT_BEFORE", "");
    vi.stubEnv("GITHUB_EVENT_AFTER", "");
    try {
      const baseBranch = git(repo.dir, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();

      git(repo.dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(path.join(repo.dir, "feature.txt"), "feature\n");
      git(repo.dir, ["add", "-A"]);
      git(repo.dir, ["commit", "-m", "feature"]);

      git(repo.dir, ["checkout", "-q", baseBranch]);
      writeFileSync(path.join(repo.dir, "main.txt"), "main\n");
      git(repo.dir, ["add", "-A"]);
      git(repo.dir, ["commit", "-m", "main"]);

      git(repo.dir, ["merge", "--no-ff", "-m", "merge feature", "feature"]);

      // Git 默认不输出合并提交自身的 combined diff，因此回退路径返回空列表而不是抛错
      expect(withCwd(repo.dir, () => getLastChangedFiles())).toStrictEqual({
        added: [],
        modified: [],
        deleted: [],
      });
    } finally {
      vi.unstubAllEnvs();

      repo.cleanup();
    }
  });
});
