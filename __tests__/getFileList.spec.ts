import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getFileList } from "../src/index.js";

describe(getFileList, () => {
  it("returns the expected source paths instead of a whole-directory snapshot", () => {
    const files = getFileList("./src");

    expect(files).toStrictEqual(
      expect.arrayContaining([
        "index.ts",
        "component-schema.ts",
        "helpers/compile.ts",
        "helpers/getFileList.ts",
        "page/markdown-renderers.ts",
        "page/schema.ts",
        "schema/common.ts",
        "schema/map.ts",
      ]),
    );
    // 快照文件不在 src 下，也不应被目录遍历带入结果
    expect(files).not.toContain("__snapshots__/getFileList.spec.ts.snap");
    expect(files.some((file) => file.endsWith(".snap"))).toBe(false);
    for (const file of files) expect(file).not.toMatch(/^\//u);
  });

  describe("getFileList path handling", () => {
    const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "getFileList-path-"));

    it("accepts an absolute directory path", () => {
      const dir = makeTempDir();
      try {
        mkdirSync(path.join(dir, "sub"), { recursive: true });
        writeFileSync(path.join(dir, "root.txt"), "");
        writeFileSync(path.join(dir, "sub/nested.txt"), "");

        const files = getFileList(dir);

        expect(files).toContain("root.txt");
        expect(files).toContain("sub/nested.txt");
        expect(files).toHaveLength(2);
        for (const file of files) expect(file).not.toMatch(/^\//u);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("resolves a relative directory path against the provided cwd", () => {
      const dir = makeTempDir();
      try {
        writeFileSync(path.join(dir, "root.txt"), "");

        expect(getFileList(".", undefined, dir)).toStrictEqual(["root.txt"]);
        expect(getFileList("./", "txt", dir)).toStrictEqual(["root.txt"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("throws for a missing directory and does not create it", () => {
      const dir = makeTempDir();
      try {
        const missingDir = path.join(dir, "does-not-exist");
        const resolvedPath = path.resolve(missingDir);

        expect(() => getFileList(missingDir)).toThrow(resolvedPath);
        expect(existsSync(missingDir)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("throws when the path is a file", () => {
      const dir = makeTempDir();
      try {
        const filePath = path.join(dir, "plain.txt");
        writeFileSync(filePath, "");

        expect(() => getFileList(filePath)).toThrow(path.resolve(filePath));
        // The file must be left untouched
        expect(existsSync(filePath)).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("getFileList nested directories", () => {
    const testDir = path.join(tmpdir(), "getFileList-test");

    const setup = (): void => {
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(path.join(testDir, "sub/deep"), { recursive: true });
      writeFileSync(path.join(testDir, "root.txt"), "");
      writeFileSync(path.join(testDir, "root.json"), "{}");
      writeFileSync(path.join(testDir, "sub/file.txt"), "");
      writeFileSync(path.join(testDir, "sub/deep/nested.txt"), "");
      writeFileSync(path.join(testDir, "sub/deep/nested.json"), "{}");
    };

    const teardown = (): void => {
      rmSync(testDir, { recursive: true, force: true });
    };

    it("returns files relative to the provided base folder", () => {
      setup();
      try {
        const files = getFileList(".", undefined, testDir);

        expect(files).toContain("root.txt");
        expect(files).toContain("root.json");
        expect(files).toContain("sub/file.txt");
        expect(files).toContain("sub/deep/nested.txt");
        expect(files).toContain("sub/deep/nested.json");
        expect(files).toHaveLength(5);
      } finally {
        teardown();
      }
    });

    it("filters by extension in nested directories", () => {
      setup();
      try {
        const files = getFileList(".", "txt", testDir);

        expect(files).toContain("root.txt");
        expect(files).toContain("sub/file.txt");
        expect(files).toContain("sub/deep/nested.txt");
        expect(files).not.toContain("root.json");
        expect(files).not.toContain("sub/deep/nested.json");
        expect(files).toHaveLength(3);
      } finally {
        teardown();
      }
    });

    it("returns correct nested paths regardless of cwd", () => {
      setup();
      try {
        const files = getFileList(".", undefined, testDir);

        // Paths should all be relative, not absolute
        for (const file of files) expect(file).not.toMatch(/^\//u);

        // Nested paths must include the directory prefix
        expect(files).toContain("sub/file.txt");
        expect(files).toContain("sub/deep/nested.txt");
      } finally {
        teardown();
      }
    });
  });

  describe("getFileList ordering", () => {
    const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "getFileList-order-"));

    it("sorts files and directories by code unit instead of readdir order", () => {
      const dir = makeTempDir();

      try {
        mkdirSync(path.join(dir, "dir-2"));
        mkdirSync(path.join(dir, "dir-10"));
        writeFileSync(path.join(dir, "a.txt"), "");
        writeFileSync(path.join(dir, "B.txt"), "");
        writeFileSync(path.join(dir, "2.txt"), "");
        writeFileSync(path.join(dir, "10.txt"), "");
        writeFileSync(path.join(dir, "dir-2/a.txt"), "");
        writeFileSync(path.join(dir, "dir-10/a.txt"), "");

        expect(getFileList(dir, "txt")).toStrictEqual([
          "10.txt",
          "2.txt",
          "B.txt",
          "a.txt",
          "dir-10/a.txt",
          "dir-2/a.txt",
        ]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("interleaves files and directories by name instead of listing files first", () => {
      const dir = makeTempDir();

      try {
        mkdirSync(path.join(dir, "a-dir"));
        writeFileSync(path.join(dir, "a-dir/x.txt"), "");
        writeFileSync(path.join(dir, "z.txt"), "");

        expect(getFileList(dir, "txt")).toStrictEqual(["a-dir/x.txt", "z.txt"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns the same order when entries are created in different orders", () => {
      const first = makeTempDir();
      const second = makeTempDir();
      const names = ["c.txt", "a.txt", "b.txt"];

      try {
        for (const name of names) writeFileSync(path.join(first, name), "");
        for (const name of names.toReversed()) writeFileSync(path.join(second, name), "");

        expect(getFileList(first, "txt")).toStrictEqual(["a.txt", "b.txt", "c.txt"]);
        expect(getFileList(second, "txt")).toStrictEqual(["a.txt", "b.txt", "c.txt"]);
      } finally {
        rmSync(first, { recursive: true, force: true });
        rmSync(second, { recursive: true, force: true });
      }
    });

    it("accepts multiple extensions and keeps the same case-sensitive rule", () => {
      const dir = makeTempDir();

      try {
        writeFileSync(path.join(dir, "a.yml"), "");
        writeFileSync(path.join(dir, "b.yaml"), "");
        writeFileSync(path.join(dir, "c.YAML"), "");
        writeFileSync(path.join(dir, "d.json"), "");

        expect(getFileList(dir, ["yml", "yaml"])).toStrictEqual(["a.yml", "b.yaml"]);
        expect(getFileList(dir, "yml")).toStrictEqual(["a.yml"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe.skipIf(process.platform === "win32")("getFileList symbolic links", () => {
    const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "getFileList-link-"));

    it("does not follow self-referential or cyclic directory links", () => {
      const dir = makeTempDir();

      try {
        mkdirSync(path.join(dir, "real"));
        writeFileSync(path.join(dir, "real/page.yml"), "");
        symlinkSync(dir, path.join(dir, "loop"));
        symlinkSync(path.join(dir, "real"), path.join(dir, "real/back"));

        expect(getFileList(dir, "yml")).toStrictEqual(["real/page.yml"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reads symlinked files inside the root once and ignores outside or broken links", () => {
      const dir = makeTempDir();

      try {
        const root = path.join(dir, "root");
        const outside = path.join(dir, "outside");

        mkdirSync(path.join(root, "sub"), { recursive: true });
        mkdirSync(outside);
        writeFileSync(path.join(root, "page.yml"), "");
        writeFileSync(path.join(outside, "secret.yml"), "");
        symlinkSync(path.join(root, "page.yml"), path.join(root, "alias.yml"));
        symlinkSync(path.join(root, "page.yml"), path.join(root, "sub/alias.yml"));
        symlinkSync(path.join(outside, "secret.yml"), path.join(root, "outside.yml"));
        symlinkSync(path.join(root, "missing.yml"), path.join(root, "broken.yml"));

        expect(getFileList(root, "yml")).toStrictEqual(["page.yml"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
