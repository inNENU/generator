import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { checkJSON } from "../src/helpers/json.js";

/**
 * 创建临时目录并在回调结束后清理
 *
 * @param run 在临时目录中执行的回调
 */
const withTempRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = mkdtempSync(path.join(tmpdir(), "innenu-json-"));

  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  }
};

/**
 * 执行 checkJSON 并返回抛出的错误
 *
 * @param directory 待检查目录
 * @returns 抛出的 AggregateError
 */
const getFailure = async (directory: string): Promise<AggregateError> => {
  try {
    await checkJSON(directory);
  } catch (err) {
    return err as AggregateError;
  }

  throw new Error("checkJSON should reject");
};

/**
 * 获取聚合错误中的错误信息列表
 *
 * @param error 聚合错误
 * @returns 错误信息列表
 */
const getMessages = (error: AggregateError): string[] =>
  (error.errors as Error[]).map((item) => item.message);

describe(checkJSON, () => {
  it("should validate JSON files nested in subdirectories", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mkdirSync(path.join(root, "nested", "deep"), { recursive: true });
      writeFileSync(path.join(root, "root.json"), JSON.stringify({ title: "root" }));
      writeFileSync(path.join(root, "nested", "page.json"), JSON.stringify({ title: "page" }));
      writeFileSync(
        path.join(root, "nested", "deep", "settings.json"),
        JSON.stringify({ enabled: true }),
      );

      await expect(checkJSON(root)).resolves.toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  it("should report a malformed JSON file exactly once with its path", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const brokenFile = path.join(root, "nested", "broken.json");

      mkdirSync(path.join(root, "nested"), { recursive: true });
      writeFileSync(path.join(root, "valid.json"), JSON.stringify({ ok: true }));
      writeFileSync(brokenFile, "{ invalid json");

      const error = await getFailure(root);
      const messages = getMessages(error);

      expect(error).toBeInstanceOf(AggregateError);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(brokenFile);
      expect(messages[0]).toContain("不是一个正确的 JSON 文件");
      expect(error.message).toContain(brokenFile);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toContain(brokenFile);
    });
  });

  it("should report each malformed JSON file once", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const brokenFiles = [path.join(root, "first.json"), path.join(root, "second.json")];

      brokenFiles.forEach((file) => writeFileSync(file, "not json"));

      const error = await getFailure(root);
      const messages = getMessages(error);

      expect(messages).toHaveLength(brokenFiles.length);
      brokenFiles.forEach((file) => {
        expect(messages.filter((message) => message.includes(file))).toHaveLength(1);
      });
      expect(errorSpy).toHaveBeenCalledTimes(brokenFiles.length);
    });
  });

  it("should ignore files that are not JSON", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      writeFileSync(path.join(root, "notes.txt"), "not json");
      writeFileSync(path.join(root, "backup.json.bak"), "not json");
      writeFileSync(path.join(root, "page.json"), JSON.stringify({ ok: true }));

      await expect(checkJSON(root)).resolves.toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  it("should report a missing directory as a traversal failure", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const missingDirectory = path.join(root, "missing");

      const error = await getFailure(missingDirectory);
      const messages = getMessages(error);

      expect(error).toBeInstanceOf(AggregateError);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(`读取目录 ${missingDirectory} 失败`);
      expect(error.message).toContain(`读取目录 ${missingDirectory} 失败`);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("should distinguish file read failures from directory failures", async () => {
    await withTempRoot(async (root) => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      const brokenLink = path.join(root, "broken.json");

      symlinkSync(path.join(root, "does-not-exist"), brokenLink, "file");

      const error = await getFailure(root);
      const messages = getMessages(error);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(`读取文件 ${brokenLink} 失败`);
      expect(messages[0]).not.toContain("读取目录");
    });
  });

  it("should handle many JSON files", async () => {
    await withTempRoot(async (root) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      for (let directoryIndex = 0; directoryIndex < 10; directoryIndex += 1) {
        const directory = path.join(root, `folder-${directoryIndex}`);

        mkdirSync(directory, { recursive: true });

        for (let fileIndex = 0; fileIndex < 20; fileIndex += 1) {
          writeFileSync(
            path.join(directory, `page-${fileIndex}.json`),
            JSON.stringify({ directory: directoryIndex, file: fileIndex }),
          );
        }
      }

      await expect(checkJSON(root)).resolves.toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  it.skipIf(process.platform === "win32")(
    "checks JSON symlinks inside the root and warns instead of silently skipping directory symlinks",
    async () => {
      await withTempRoot(async (root) => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const linkedFile = path.join(root, "linked.json");

        const outside = mkdtempSync(path.join(tmpdir(), "innenu-json-outside-"));

        try {
          mkdirSync(path.join(outside, "nested"), { recursive: true });
          writeFileSync(path.join(root, "target.yaml"), "{ invalid json");
          writeFileSync(path.join(outside, "nested", "inside.json"), "{ also invalid");
          symlinkSync(path.join(root, "target.yaml"), linkedFile);
          symlinkSync(path.join(outside, "nested"), path.join(root, "linked-dir"));

          const error = await getFailure(root);
          const messages = getMessages(error);

          expect(messages).toHaveLength(1);
          expect(messages[0]).toContain(linkedFile);
          expect(messages[0]).toContain("不是一个正确的 JSON 文件");
          expect(messages.some((message) => message.includes("inside.json"))).toBe(false);
          expect(errorSpy).toHaveBeenCalledTimes(1);
          expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("跳过符号链接目录"));
        } finally {
          rmSync(outside, { recursive: true, force: true });
        }
      });
    },
  );

  it.skipIf(process.platform === "win32")(
    "reports JSON symlinks that point outside the checked directory",
    async () => {
      await withTempRoot(async (root) => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        const outside = path.join(root, "outside");
        const checkedRoot = path.join(root, "checked");

        mkdirSync(outside, { recursive: true });
        mkdirSync(checkedRoot, { recursive: true });
        writeFileSync(path.join(outside, "secret.json"), JSON.stringify({ ok: true }));
        symlinkSync(path.join(outside, "secret.json"), path.join(checkedRoot, "linked.json"));

        const error = await getFailure(checkedRoot);
        const messages = getMessages(error);

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain("指向检查目录之外");
        expect(messages[0]).toContain(path.join(checkedRoot, "linked.json"));
      });
    },
  );
});
