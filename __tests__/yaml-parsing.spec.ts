import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  checkYamlFiles,
  convertYamlFilesToJson,
  convertYamlFilesToMarkdown,
  parseYaml,
} from "../src/helpers/yaml.js";

const createTempDir = (): string => mkdtempSync(path.join(tmpdir(), "innenu-yaml-"));

const removeDir = (dir: string): void => rmSync(dir, { force: true, recursive: true });

describe(parseYaml, () => {
  it("returns undefined for empty or comment-only documents", () => {
    expect(parseYaml("")).toBeUndefined();
    expect(parseYaml("  \n\t\n")).toBeUndefined();
    expect(parseYaml("# only a comment\n# another comment")).toBeUndefined();
  });

  it("parses valid YAML", () => {
    expect(parseYaml("title: 首页\ncount: 2")).toStrictEqual({ count: 2, title: "首页" });
  });

  it("throws a Chinese error containing the file path", () => {
    expect(() => parseYaml("title: [", "pages/broken.yml")).toThrow(/YAML 解析失败/u);
    expect(() => parseYaml("title: [", "pages/broken.yml")).toThrow(/pages\/broken\.yml/u);
  });
});

describe(checkYamlFiles, () => {
  it("skips empty files with a warning and still checks valid files", () => {
    const dir = createTempDir();

    try {
      writeFileSync(path.join(dir, "valid.yml"), "title: 首页\n");
      writeFileSync(path.join(dir, "empty.yml"), "# nothing here\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);
      const seen: string[] = [];

      checkYamlFiles<{ title: string }>(dir, (data, filePath) => {
        seen.push(`${filePath}:${data.title}`);
      });

      expect(seen).toStrictEqual(["valid:首页"]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("空 YAML 文件已跳过"));
      warnSpy.mockRestore();
    } finally {
      removeDir(dir);
    }
  });

  it("reports parse errors with the source file path", () => {
    const dir = createTempDir();

    try {
      writeFileSync(path.join(dir, "broken.yml"), "title: [\n");

      expect(() => checkYamlFiles(dir, () => undefined)).toThrow(/broken\.yml/u);
    } finally {
      removeDir(dir);
    }
  });
});

describe(convertYamlFilesToJson, () => {
  it("converts valid files, skips empty files, and aggregates per-file errors", () => {
    const source = createTempDir();
    const target = createTempDir();

    try {
      writeFileSync(path.join(source, "valid.yml"), "title: 首页\n");
      writeFileSync(path.join(source, "empty.yml"), "");
      writeFileSync(path.join(source, "broken.yml"), "title: [\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      let caught: unknown;

      try {
        convertYamlFilesToJson(source, target);
      } catch (err) {
        caught = err;
      }

      warnSpy.mockRestore();

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).message).toContain("YAML 转 JSON 失败");
      expect(String((caught as AggregateError).errors[0])).toContain("broken.yml");
      const validContent = readFileSync(path.join(target, "valid.json"), { encoding: "utf-8" });
      const emptyContent = (): string =>
        readFileSync(path.join(target, "empty.json"), { encoding: "utf-8" });

      expect(JSON.parse(validContent)).toStrictEqual({ title: "首页" });
      expect(emptyContent).toThrow(/ENOENT/u);
    } finally {
      removeDir(source);
      removeDir(target);
    }
  });
});

describe(convertYamlFilesToMarkdown, () => {
  it("keeps converting other files when one file fails", () => {
    const source = createTempDir();
    const target = createTempDir();

    try {
      writeFileSync(path.join(source, "valid.yml"), "title: 首页\n");
      writeFileSync(path.join(source, "broken.yml"), "title: [\n");

      let caught: unknown;

      try {
        convertYamlFilesToMarkdown(source, () => "# 转换结果\n", target);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect(readFileSync(path.join(target, "valid.md"), { encoding: "utf-8" })).toBe(
        "# 转换结果\n",
      );
    } finally {
      removeDir(source);
      removeDir(target);
    }
  });
});

describe("yaml alias protection", () => {
  it("allows normal shared aliases", () => {
    expect(parseYaml("base: &base { name: 首页 }\ncopy: *base")).toStrictEqual({
      base: { name: "首页" },
      copy: { name: "首页" },
    });
  });

  it("rejects documents with too many aliases", () => {
    const aliases = Array.from({ length: 101 }, () => "*base").join(",");

    expect(() => parseYaml(`base: &base 1\nlist: [${aliases}]`, "bomb.yml")).toThrow(
      /YAML 解析失败/u,
    );
  });

  it("rejects self-referential aliases", () => {
    expect(() => parseYaml("node: &node\n  self: *node", "cycle.yml")).toThrow(/循环引用/u);
  });

  it("rejects exponential alias expansion", () => {
    const level = (previous: string): string =>
      `  - [${Array.from({ length: 10 }, () => `*${previous}`).join(",")}]`;

    const content = [
      "l0: &l0 [1,1,1,1,1,1,1,1,1,1]",
      "l1: &l1",
      level("l0"),
      "l2: &l2",
      level("l1"),
      "l3: &l3",
      level("l2"),
      "l4: &l4",
      level("l3"),
      "l5: &l5",
      level("l4"),
      "root: *l5",
    ].join("\n");

    expect(() => parseYaml(content, "bomb.yml")).toThrow(/展开后过大/u);
  });
});
