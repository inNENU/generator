import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkPagePath,
  checkYamlFiles,
  config,
  convertYamlFilesToJson,
  convertYamlFilesToMarkdown,
  getYamlMap,
  resetConfig,
} from "../src/index.js";

const makeTempDir = (): string => mkdtempSync(path.join(tmpdir(), "yaml-extensions-"));

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf-8"));

describe("yaml extension consistency", () => {
  it("converts both .yml and .yaml sources to JSON", () => {
    const dir = makeTempDir();

    try {
      const source = path.join(dir, "source");
      const target = path.join(dir, "target");

      mkdirSync(source, { recursive: true });
      writeFileSync(path.join(source, "a.yml"), "title: A\n");
      writeFileSync(path.join(source, "b.yaml"), "title: B\n");

      convertYamlFilesToJson<{ title: string }>(source, target, (data) => data);

      expect(readJson(path.join(target, "a.json"))).toStrictEqual({ title: "A" });
      expect(readJson(path.join(target, "b.json"))).toStrictEqual({ title: "B" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("converts both extensions to Markdown and maps index.yaml to README.md", () => {
    const dir = makeTempDir();

    try {
      const source = path.join(dir, "source");
      const target = path.join(dir, "target");

      mkdirSync(path.join(source, "guide"), { recursive: true });
      writeFileSync(path.join(source, "guide/index.yaml"), "title: Index\n");
      writeFileSync(path.join(source, "guide/page.yml"), "title: Page\n");

      convertYamlFilesToMarkdown<{ title: string }>(source, (data) => `# ${data.title}\n`, target);

      expect(readFileSync(path.join(target, "guide/README.md"), "utf-8")).toBe("# Index\n");
      expect(readFileSync(path.join(target, "guide/page.md"), "utf-8")).toBe("# Page\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects .yml and .yaml sources that map to the same output", () => {
    const dir = makeTempDir();

    try {
      const source = path.join(dir, "source");
      const target = path.join(dir, "target");

      mkdirSync(source, { recursive: true });
      writeFileSync(path.join(source, "same.yml"), "title: YML\n");
      writeFileSync(path.join(source, "same.yaml"), "title: YAML\n");

      expect(() => convertYamlFilesToJson(source, target)).toThrow(/输出路径冲突/u);
      expect(existsSync(path.join(target, "same.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads both extensions in getYamlMap and checkYamlFiles", () => {
    const dir = makeTempDir();

    try {
      writeFileSync(path.join(dir, "a.yml"), "title: A\n");
      writeFileSync(path.join(dir, "b.yaml"), "title: B\n");

      expect(
        getYamlMap<{ title: string }, string>(dir, (data) => data.title)
          .filter((item) => item.type === "file")
          .map((item) => [item.filename, item.value]),
      ).toStrictEqual([
        ["a.yml", "A"],
        ["b.yaml", "B"],
      ]);

      const checked: string[] = [];

      checkYamlFiles<{ title: string }>(dir, (_data, filePath) => {
        checked.push(filePath);
      });

      expect(checked).toStrictEqual(["a", "b"]);
    } finally {
      resetConfig();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds .yaml pages in checkPagePath", () => {
    const dir = makeTempDir();

    try {
      writeFileSync(path.join(dir, "a.yml"), "title: A\n");
      writeFileSync(path.join(dir, "b.yaml"), "title: B\n");
      config({ pageFolder: dir });

      expect(checkPagePath("/b", "a")).toStrictEqual([]);
      expect(checkPagePath("/a", "b")).toStrictEqual([]);
      expect(checkPagePath("/missing", "a", "测试页")).toStrictEqual([
        "路径 missing 在 测试页 中不存在",
      ]);
    } finally {
      resetConfig();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
