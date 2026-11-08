import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getFileMap } from "../src/index.js";
import type { FileMapItem } from "../src/index.js";

const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "getFileMap-"));

const entryName = (item: FileMapItem): string =>
  item.type === "file" ? item.filename : item.dirname;

describe(getFileMap, () => {
  it("maps nested files with their contents and filters by extension", () => {
    const dir = makeTempDir();

    try {
      mkdirSync(path.join(dir, "nested/deep"), { recursive: true });
      writeFileSync(path.join(dir, "root.txt"), "root", "utf-8");
      writeFileSync(path.join(dir, "ignored.md"), "ignored", "utf-8");
      writeFileSync(path.join(dir, "nested/child.txt"), "child", "utf-8");
      writeFileSync(path.join(dir, "nested/deep/leaf.txt"), "leaf", "utf-8");

      expect(getFileMap(dir, "txt")).toStrictEqual([
        {
          type: "dir",
          dirname: "nested",
          content: [
            { type: "file", filename: "child.txt", content: "child" },
            {
              type: "dir",
              dirname: "deep",
              content: [{ type: "file", filename: "leaf.txt", content: "leaf" }],
            },
          ],
        },
        { type: "file", filename: "root.txt", content: "root" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("includes files of every extension when ext is omitted", () => {
    const dir = makeTempDir();

    try {
      writeFileSync(path.join(dir, "page.yml"), "title: page", "utf-8");
      writeFileSync(path.join(dir, "notes.md"), "# notes", "utf-8");

      expect(getFileMap(dir)).toStrictEqual([
        { type: "file", filename: "notes.md", content: "# notes" },
        { type: "file", filename: "page.yml", content: "title: page" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws a clear error for a missing directory", () => {
    const dir = makeTempDir();

    try {
      const missingDir = path.join(dir, "does-not-exist");
      const resolvedPath = path.resolve(missingDir);

      expect(() => getFileMap(missingDir)).toThrow(/^目录不存在: /u);
      expect(() => getFileMap(missingDir)).toThrow(resolvedPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws a clear error when the path is not a directory", () => {
    const dir = makeTempDir();

    try {
      const filePath = path.join(dir, "plain.txt");
      writeFileSync(filePath, "plain", "utf-8");

      expect(() => getFileMap(filePath)).toThrow(/^路径不是目录: /u);
      expect(() => getFileMap(filePath)).toThrow(path.resolve(filePath));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "does not recurse into symlinked directories and survives cyclic links",
    () => {
      const dir = makeTempDir();

      try {
        const root = path.join(dir, "root");

        mkdirSync(path.join(root, "sub"), { recursive: true });
        writeFileSync(path.join(root, "a.txt"), "a", "utf-8");
        writeFileSync(path.join(root, "sub/b.txt"), "b", "utf-8");
        // 循环链接：root/loop -> root，若跟随会无限递归
        symlinkSync(root, path.join(root, "loop"), "dir");

        const items = getFileMap(root, "txt");

        expect(items).toStrictEqual([
          { type: "file", filename: "a.txt", content: "a" },
          {
            type: "dir",
            dirname: "sub",
            content: [{ type: "file", filename: "b.txt", content: "b" }],
          },
        ]);
        expect(items.map((item) => entryName(item))).not.toContain("loop");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")("reads symlinked files but ignores broken links", () => {
    const dir = makeTempDir();

    try {
      const root = path.join(dir, "root");
      const target = path.join(dir, "target.txt");

      mkdirSync(root, { recursive: true });
      writeFileSync(target, "target", "utf-8");
      symlinkSync(target, path.join(root, "linked.txt"));
      symlinkSync(path.join(dir, "missing.txt"), path.join(root, "broken.txt"));

      expect(getFileMap(root, "txt")).toStrictEqual([
        { type: "file", filename: "linked.txt", content: "target" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("sorts directory entries so the map is deterministic", () => {
    const dir = makeTempDir();

    try {
      mkdirSync(path.join(dir, "z-dir"), { recursive: true });
      mkdirSync(path.join(dir, "b-dir"), { recursive: true });
      writeFileSync(path.join(dir, "z.txt"), "z", "utf-8");
      writeFileSync(path.join(dir, "a.txt"), "a", "utf-8");
      writeFileSync(path.join(dir, "b-dir/d.txt"), "d", "utf-8");
      writeFileSync(path.join(dir, "b-dir/c.txt"), "c", "utf-8");
      writeFileSync(path.join(dir, "z-dir/e.txt"), "e", "utf-8");

      const first = getFileMap(dir, "txt");
      const second = getFileMap(dir, "txt");

      expect(first.map((item) => entryName(item))).toStrictEqual([
        "a.txt",
        "b-dir",
        "z-dir",
        "z.txt",
      ]);
      expect(first[1]).toMatchObject({
        type: "dir",
        dirname: "b-dir",
        content: [
          { type: "file", filename: "c.txt" },
          { type: "file", filename: "d.txt" },
        ],
      });
      expect(second).toStrictEqual(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
