import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getFileList } from "../src/index.js";

describe(getFileList, () => {
  it("should return a list of files in the specified directory", () => {
    expect(getFileList("./src")).toMatchSnapshot();
  });

  describe("getFileList nested directories", () => {
    const testDir = join(tmpdir(), "getFileList-test");

    const setup = (): void => {
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(join(testDir, "sub/deep"), { recursive: true });
      writeFileSync(join(testDir, "root.txt"), "");
      writeFileSync(join(testDir, "root.json"), "{}");
      writeFileSync(join(testDir, "sub/file.txt"), "");
      writeFileSync(join(testDir, "sub/deep/nested.txt"), "");
      writeFileSync(join(testDir, "sub/deep/nested.json"), "{}");
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
        for (const file of files) expect(file).not.toMatch(/^\//);

        // Nested paths must include the directory prefix
        expect(files).toContain("sub/file.txt");
        expect(files).toContain("sub/deep/nested.txt");
      } finally {
        teardown();
      }
    });
  });
});
