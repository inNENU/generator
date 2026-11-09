import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateKnowledgeIndex } from "../src/index.js";

const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "determinism-"));

interface KnowledgeIndexItem {
  path: string;
}

/**
 * 读取生成的 JSON 知识索引
 *
 * @param distFolder 输出目录
 * @returns 索引项列表
 */
const readIndex = (distFolder: string): KnowledgeIndexItem[] =>
  JSON.parse(readFileSync(path.join(distFolder, "index.json"), "utf-8")) as KnowledgeIndexItem[];

describe("knowledge index determinism", () => {
  it("orders equal-priority pages by path instead of directory traversal order", () => {
    const dir = makeTempDir();

    try {
      const source = path.join(dir, "pages");
      const dist = path.join(dir, "dist");

      mkdirSync(path.join(source, "a"), { recursive: true });
      writeFileSync(
        path.join(source, "a/x.yml"),
        "title: A\ncontent:\n  - tag: text\n    text: A\n",
      );
      writeFileSync(path.join(source, "z.yml"), "title: Z\ncontent:\n  - tag: text\n    text: Z\n");

      generateKnowledgeIndex(source, dist, { format: "json" });

      expect(readIndex(dist).map((item) => item.path)).toStrictEqual(["a/x", "z"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("produces identical bytes when the same tree is created in a different order", () => {
    const dir = makeTempDir();

    try {
      const first = path.join(dir, "first");
      const second = path.join(dir, "second");
      const firstDist = path.join(dir, "first-dist");
      const secondDist = path.join(dir, "second-dist");
      const files: [string, string][] = [
        ["a.yml", "title: A\ncontent:\n  - tag: text\n    text: A\n"],
        ["b/c.yaml", "title: C\ncontent:\n  - tag: text\n    text: C\n"],
        ["z.yml", "title: Z\ncontent:\n  - tag: text\n    text: Z\n"],
      ];

      for (const [filePath, content] of files) {
        const absolutePath = path.join(first, filePath);

        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, content);
      }

      for (const [filePath, content] of files.toReversed()) {
        const absolutePath = path.join(second, filePath);

        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, content);
      }

      generateKnowledgeIndex(first, firstDist, { format: "json" });
      generateKnowledgeIndex(second, secondDist, { format: "json" });

      expect(readFileSync(path.join(firstDist, "index.json"), "utf-8")).toBe(
        readFileSync(path.join(secondDist, "index.json"), "utf-8"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
