import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  checkYamlFiles,
  convertYamlFilesToJson,
  convertYamlFilesToMarkdown,
  getYamlMap,
  parseYaml,
} from "../src/helpers/yaml.js";

const createTempDir = (): string => mkdtempSync(path.join(tmpdir(), "innenu-yaml-"));

const removeDir = (dir: string): void => rmSync(dir, { force: true, recursive: true });

/**
 * 列出目标文件夹中的实际输出，忽略生成清单
 *
 * @param dir 目标文件夹
 * @returns 排序后的文件名
 */
const listOutputs = (dir: string): string[] =>
  readdirSync(dir)
    .filter((filename) => !filename.startsWith(".innenu-generated."))
    .sort();

describe(parseYaml, () => {
  it("returns undefined for empty or comment-only documents", () => {
    expect(parseYaml("")).toBeUndefined();
    expect(parseYaml("  \n\t\n")).toBeUndefined();
    expect(parseYaml("# only a comment\n# another comment")).toBeUndefined();
  });

  it("returns undefined for documents without a scalar", () => {
    expect(parseYaml("---")).toBeUndefined();
    expect(parseYaml("---\n")).toBeUndefined();
    expect(parseYaml("--- # comment only\n# another comment")).toBeUndefined();
    expect(parseYaml("---\n...")).toBeUndefined();
  });

  it("only treats column-0 markers and directives as non-content", () => {
    expect(parseYaml("%YAML 1.2\n---")).toBeUndefined();
    expect(parseYaml("%TAG ! tag:example.com,2000:\n---")).toBeUndefined();
    expect(parseYaml("...\n")).toBeUndefined();
    expect(parseYaml("... # end of document")).toBeUndefined();

    // 缩进的 `...` 以及出现在后续行的缩进 `---` 是普通标量，不是文档标记
    expect(parseYaml("  ...")).toBe("...");
    expect(parseYaml("---\n  ---")).toBe("---");
    expect(parseYaml("\n  ---")).toBe("---");
    expect(parseYaml("# c\n  ---")).toBe("---");
  });

  it("treats a stream-leading indented `---` as a document marker", () => {
    // js-yaml 会把文件首行缩进的 `---` 当作文档开始标记，这里与之保持一致
    expect(parseYaml("  ---")).toBeUndefined();
    expect(parseYaml(" ---")).toBeUndefined();
    expect(parseYaml("    ---")).toBeUndefined();
    expect(parseYaml("\t---")).toBeUndefined();
    expect(parseYaml("  ---\r\n")).toBeUndefined();
    expect(parseYaml("  --- # c")).toBeUndefined();
    expect(parseYaml("  ---\r\n# c\r\n")).toBeUndefined();
  });

  it("keeps content after a stream-leading indented `---`", () => {
    // 首行缩进的文档标记不能把紧随其后的实际内容一起跳过
    expect(parseYaml("  ---\n  foo")).toBe("foo");
    expect(parseYaml("  --- # c\nfoo: 1")).toStrictEqual({ foo: 1 });
  });

  it("recognizes a stream-leading indented `---` after a BOM", () => {
    expect(parseYaml("\uFEFF  ---\na: 1")).toStrictEqual({ a: 1 });
  });

  it("treats content after a stream-leading indented `---` as document content", () => {
    expect(parseYaml("  --- foo")).toBe("foo");
    expect(parseYaml("  --- foo\nbar")).toBe("foo bar");
  });

  it("handles CRLF and CR line endings in markers and comments", () => {
    expect(parseYaml("--- # c\r\n")).toBeUndefined();
    expect(parseYaml("--- # c\r")).toBeUndefined();
    expect(parseYaml("... # end\r\n")).toBeUndefined();
    expect(parseYaml("... # end\r")).toBeUndefined();
    expect(parseYaml("--- # c\r\n# d\r\n")).toBeUndefined();
    expect(parseYaml("---\r\n")).toBeUndefined();

    // 有实际内容时仍按原有语义解析
    expect(parseYaml("---\r\ntitle: x\r\n")).toStrictEqual({ title: "x" });
    expect(parseYaml("title: 首页\r\ncount: 2\r\n")).toStrictEqual({ count: 2, title: "首页" });
  });

  it("strips a leading BOM before checking marker-only documents", () => {
    expect(parseYaml("\uFEFF---")).toBeUndefined();
    expect(parseYaml("\uFEFF---\r\n")).toBeUndefined();
    expect(parseYaml("\uFEFF--- # c\r\n")).toBeUndefined();
  });

  it("does not silently treat an indented directive-like line as an empty document", () => {
    // `%` 指令必须位于第 0 列；缩进的 `%foo` 不是指令，而是非法 YAML，应报错而不是被当作空文档跳过
    expect(() => parseYaml("  %foo")).toThrow(/YAML 解析失败/u);
  });

  it("only treats %YAML and %TAG directives as non-content", () => {
    // 其它 `%` 行不再仅凭前缀被跳过，交给 js-yaml 判定：缺少 `---` 时是非法 YAML
    expect(() => parseYaml("%foo")).toThrow(/YAML 解析失败/u);
    expect(parseYaml("%foo\n---\ntitle: x")).toStrictEqual({ title: "x" });
  });

  it("keeps explicit empty string scalars", () => {
    expect(parseYaml('""')).toBe("");
    expect(parseYaml("''")).toBe("");
  });

  it("parses valid YAML", () => {
    expect(parseYaml("title: 首页\ncount: 2")).toStrictEqual({ count: 2, title: "首页" });
  });

  it("throws a Chinese error containing the file path", () => {
    expect(() => parseYaml("title: [", "pages/broken.yml")).toThrow(/YAML 解析失败/u);
    expect(() => parseYaml("title: [", "pages/broken.yml")).toThrow(/pages\/broken\.yml/u);

    const getError = (): unknown => {
      try {
        parseYaml("title: [", "pages/broken.yml");
      } catch (err) {
        return err;
      }
      return undefined;
    };
    const error = getError();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toBeInstanceOf(Error);
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
      /别名展开后过大（maxAliases: 100）/u,
    );
  });

  it("rejects documents with more than 100 distinct aliases", () => {
    const content = Array.from(
      { length: 101 },
      (_, index) => `a${index}: &a${index} ${index}\nb${index}: *a${index}`,
    ).join("\n");

    expect(() => parseYaml(content, "bomb.yml")).toThrow(/别名展开后过大（maxAliases: 100）/u);
  });

  it("allows 100 references to the same anchor", () => {
    const content = `base: &base 1\n${Array.from({ length: 100 }, (_, index) => `v${index}: *base`).join("\n")}`;

    expect(parseYaml<Record<string, number>>(content)).toMatchObject({ base: 1, v0: 1, v99: 1 });
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

    expect(() => parseYaml(content, "bomb.yml")).toThrow(/文档展开后过大，可能存在别名炸弹/u);
  });
});

describe("yaml JSON schema scalar resolution", () => {
  it("resolves only JSON scalars and keeps YAML 1.1 style values as strings", () => {
    const cases: [string, unknown][] = [
      ["42", 42],
      ["0x1A", "0x1A"],
      ["0o17", "0o17"],
      ["1:20", "1:20"],
      ["2024-01-01", "2024-01-01"],
      ["true", true],
      ["TRUE", "TRUE"],
      ["yes", "yes"],
      ["~", "~"],
      [".inf", ".inf"],
      ["1_000", "1_000"],
      ["null", null],
      ["Null", "Null"],
    ];

    for (const [source, expected] of cases)
      expect(parseYaml(`value: ${source}`)).toStrictEqual({ value: expected });
  });

  it("supports explicit integer tags with JSON bases", () => {
    expect(parseYaml("value: !!int 0x1A")).toStrictEqual({ value: 26 });
    expect(parseYaml("value: !!int 0o17")).toStrictEqual({ value: 15 });
    expect(parseYaml("value: !!int 0b101")).toStrictEqual({ value: 5 });
  });

  it("rejects multiple documents in a stream", () => {
    expect(() => parseYaml("---\na: 1\n---\nb: 2")).toThrow(/expected a single document/u);
  });
});

describe("yaml strictness parity", () => {
  it("resolves explicit float tags like the JSON schema", () => {
    expect(parseYaml("v: !!float .5")).toStrictEqual({ v: 0.5 });
    expect(parseYaml("v: !!float -.5")).toStrictEqual({ v: -0.5 });
    expect(parseYaml("v: !!float .inf")).toStrictEqual({ v: Number.POSITIVE_INFINITY });
    expect(parseYaml("v: !!float .nan")).toStrictEqual({ v: Number.NaN });
    expect(() => parseYaml("v: !!float abc")).toThrow(/explicit tag/u);
    expect(() => parseYaml("v: !!float 1.2.3")).toThrow(/explicit tag/u);
  });

  it("rejects explicit tags with invalid values or wrong node kinds", () => {
    const cases = [
      "v: !!bool yes",
      "v: !!bool TRUE",
      "v: !!null ~",
      "v: !!null NULL",
      "v: !!str { a: 1 }",
      "v: !!map [1]",
      "v: !!int [1]",
      "v: !!seq { a: 1 }",
    ];

    for (const source of cases) {
      expect(() => parseYaml(source, "tag.yml")).toThrow(
        /explicit tag|unknown (?:mapping|sequence) tag/u,
      );
    }

    expect(() => parseYaml("? [a, b]\n: v", "tag.yml")).toThrow(/complex keys/u);
  });

  it("rejects tags outside the JSON schema", () => {
    const cases = ["v: !foo bar", "v: !!timestamp 2024-01-01", "v: !!binary aGVsbG8=", "v: !!set"];

    for (const source of cases) {
      expect(() => parseYaml(source, "tag.yml")).toThrow(
        /unknown (?:scalar|mapping|sequence) tag/u,
      );
    }
  });

  it("rejects NUL bytes", () => {
    expect(() => parseYaml(`v: "a${String.fromCodePoint(0)}b"`, "nul.yml")).toThrow(/null byte/u);
  });
});

describe("yaml conversion output", () => {
  it("writes falsy conversion results and leaves no temp files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-falsy-"));

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1");

      convertYamlFilesToJson(source, target, () => false);

      expect(readFileSync(path.join(target, "a.json"), "utf-8")).toBe("false");
      expect(readdirSync(target).some((file) => file.endsWith(".tmp"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips null and undefined conversion results but writes other falsy values", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-skip-"));

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      for (const name of ["null", "undefined", "empty", "zero", "false", "text"])
        writeFileSync(path.join(source, `${name}.yml`), `name: ${name}`);

      const results: Record<string, unknown> = {
        null: null,
        undefined,
        empty: "",
        zero: 0,
        false: false,
        text: "x",
      };

      convertYamlFilesToJson(source, target, (_data, filePath) => results[filePath]);

      expect(listOutputs(target)).toStrictEqual([
        "empty.json",
        "false.json",
        "text.json",
        "zero.json",
      ]);
      expect(readFileSync(path.join(target, "empty.json"), "utf-8")).toBe('""');
      expect(readFileSync(path.join(target, "zero.json"), "utf-8")).toBe("0");
      expect(readFileSync(path.join(target, "false.json"), "utf-8")).toBe("false");
      expect(readFileSync(path.join(target, "text.json"), "utf-8")).toBe('"x"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not write an output for a document containing only markers", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-marker-"));

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      writeFileSync(path.join(source, "empty.yml"), "---\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      convertYamlFilesToJson(source, target, (data) => data);

      expect(existsSync(path.join(target, "empty.json"))).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("空 YAML 文件已跳过"));
      warnSpy.mockRestore();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes stale json outputs when a source file is deleted", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-stale-json-"));

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1");
      writeFileSync(path.join(source, "b.yml"), "b: 2");

      convertYamlFilesToJson(source, target, (data) => data);

      rmSync(path.join(source, "b.yml"));
      writeFileSync(path.join(source, "c.yml"), "c: 3");

      convertYamlFilesToJson(source, target, (data) => data);

      expect(listOutputs(target)).toStrictEqual(["a.json", "c.json"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes stale README output for a deleted index.yml", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-stale-md-"));

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(path.join(source, "guide"), { recursive: true });

      writeFileSync(path.join(source, "guide", "index.yml"), "title: 指南");

      convertYamlFilesToMarkdown(source, () => "# 指南", target);

      expect(readFileSync(path.join(target, "guide", "README.md"), "utf-8")).toBe("# 指南");

      rmSync(path.join(source, "guide", "index.yml"));
      convertYamlFilesToMarkdown(source, () => "# 指南", target);

      expect(existsSync(path.join(target, "guide", "README.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not delete unrelated files when source equals target", () => {
    const root = mkdtempSync(path.join(tmpdir(), "yaml-same-dir-"));

    try {
      writeFileSync(path.join(root, "a.yml"), "a: 1");
      writeFileSync(path.join(root, "manual.json"), "{}");

      convertYamlFilesToJson(root, root, (data) => data);

      expect(existsSync(path.join(root, "manual.json"))).toBe(true);
      expect(existsSync(path.join(root, "a.json"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("yaml unsafe integers", () => {
  it("warns when an integer exceeds the safe range", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    try {
      expect(parseYaml<{ id: number }>("id: 9007199254740993", "data/big.yml")).toStrictEqual({
        id: 9_007_199_254_740_992,
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("9007199254740993"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("data/big.yml"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("引号"));

      expect(parseYaml<{ id: number }>("id: -9007199254740993", "data/negative.yml")).toStrictEqual(
        {
          id: -9_007_199_254_740_992,
        },
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("-9007199254740993"));

      expect(parseYaml<{ id: number }>("id: !!int 0x20000000000001", "data/hex.yml")).toStrictEqual(
        {
          id: 9_007_199_254_740_992,
        },
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("0x20000000000001"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not warn for safe integers or quoted long numbers", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    try {
      expect(parseYaml("id: 9007199254740991")).toStrictEqual({ id: 9_007_199_254_740_991 });
      expect(parseYaml('id: "9007199254740993"')).toStrictEqual({ id: "9007199254740993" });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe(getYamlMap, () => {
  it("skips empty YAML files with a warning instead of throwing", () => {
    const dir = createTempDir();

    try {
      writeFileSync(path.join(dir, "valid.yml"), "title: 首页\n");
      writeFileSync(path.join(dir, "comment.yml"), "# 只有注释\n");
      writeFileSync(path.join(dir, "marker.yml"), "---\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        expect(getYamlMap<{ title: string }, string>(dir, (data) => data.title)).toStrictEqual([
          { type: "file", filename: "valid.yml", value: "首页" },
        ]);
        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("空 YAML 文件已跳过"));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("comment.yml"));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("marker.yml"));
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      removeDir(dir);
    }
  });

  it("keeps directories and drops only their empty files", () => {
    const dir = createTempDir();

    try {
      mkdirSync(path.join(dir, "nested"));
      writeFileSync(path.join(dir, "nested", "page.yml"), "title: 子页\n");
      writeFileSync(path.join(dir, "nested", "empty.yml"), "---\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        expect(getYamlMap<{ title: string }, string>(dir, (data) => data.title)).toStrictEqual([
          {
            type: "dir",
            dirname: "nested",
            content: [{ type: "file", filename: "page.yml", value: "子页" }],
          },
        ]);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("empty.yml"));
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      removeDir(dir);
    }
  });
});
