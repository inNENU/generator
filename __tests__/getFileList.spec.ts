import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getFileList } from "../src/index.js";

describe(getFileList, () => {
  it("should return a list of files in the specified directory", () => {
    expect(getFileList("./src")).toMatchSnapshot();
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
});
