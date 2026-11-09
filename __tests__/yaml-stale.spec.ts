import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  convertYamlFilesToJson,
  convertYamlFilesToMarkdown,
  removeStaleOutputs,
} from "../src/helpers/index.js";

interface GenerationManifest {
  version: number;
  files: string[];
}

const MANIFEST_PREFIX = ".innenu-generated.";

const createTempDir = (): string => mkdtempSync(path.join(tmpdir(), "innenu-stale-"));

const removeDir = (dir: string): void => rmSync(dir, { force: true, recursive: true });

const getManifestNames = (dir: string): string[] =>
  readdirSync(dir).filter(
    (filename) => filename.startsWith(MANIFEST_PREFIX) && filename.endsWith(".json"),
  );

const getManifestFilename = (dir: string, extension: ".json" | ".md"): string => {
  const prefix = `${MANIFEST_PREFIX}${extension.slice(1)}.`;
  const filename = getManifestNames(dir).find((name) => name.startsWith(prefix));

  if (!filename) throw new Error(`未找到 ${extension} 生成清单: ${dir}`);

  return path.join(dir, filename);
};

const readManifest = (dir: string, extension: ".json" | ".md"): GenerationManifest =>
  JSON.parse(readFileSync(getManifestFilename(dir, extension), "utf-8")) as GenerationManifest;

const writeManifest = (dir: string, extension: ".json" | ".md", files: readonly string[]): void => {
  writeFileSync(
    getManifestFilename(dir, extension),
    `${JSON.stringify({ version: 1, files }, null, 2)}\n`,
  );
};

const getWarnings = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.map((call) => call.map(String).join(" "));

const getOtherManifest = (dir: string, known: string | undefined): string => {
  const filename = getManifestNames(dir).find((name) => name !== known);

  if (!filename) throw new Error(`未找到与 ${known} 不同的生成清单: ${dir}`);

  return filename;
};

const createSkippingConverter = (): {
  convert: (data: unknown, filePath: string) => unknown;
  skip: (filePath: string) => void;
} => {
  const skipped = new Set<string>();

  return {
    convert: (data, filePath) => (skipped.has(filePath) ? null : data),
    skip: (filePath) => {
      skipped.add(filePath);
    },
  };
};

const listOutputs = (dir: string): string[] =>
  readdirSync(dir)
    .filter((filename) => !filename.startsWith(MANIFEST_PREFIX))
    .sort();

describe("yaml stale output cleanup", () => {
  it("keeps hand-written files when the manifest exists", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(path.join(source, "guide"), { recursive: true });
      mkdirSync(path.join(target, "guide"), { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "title: 首页\n");
      writeFileSync(path.join(source, "z.yml"), "title: 末页\n");
      writeFileSync(path.join(source, "guide", "index.yml"), "title: 指南\n");

      writeFileSync(path.join(target, "manual.json"), '{"manual":true}\n');
      writeFileSync(path.join(target, "README.md"), "# 手写首页\n");
      writeFileSync(path.join(target, "guide", "notes.md"), "# 手写笔记\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(source, target, (data) => data);
        convertYamlFilesToJson(source, target, (data) => data);
        convertYamlFilesToMarkdown(source, () => "# 生成内容\n", target);
        convertYamlFilesToMarkdown(source, () => "# 生成内容\n", target);
      } finally {
        warnSpy.mockRestore();
      }

      expect({
        manual: readFileSync(path.join(target, "manual.json"), "utf-8"),
        readme: readFileSync(path.join(target, "README.md"), "utf-8"),
        notes: readFileSync(path.join(target, "guide", "notes.md"), "utf-8"),
      }).toStrictEqual({
        manual: '{"manual":true}\n',
        readme: "# 手写首页\n",
        notes: "# 手写笔记\n",
      });

      expect({
        page: existsSync(path.join(target, "a.json")),
        guideJson: existsSync(path.join(target, "guide", "index.json")),
        guideMarkdown: existsSync(path.join(target, "guide", "README.md")),
      }).toStrictEqual({ page: true, guideJson: true, guideMarkdown: true });

      expect(getManifestNames(target)).toHaveLength(2);
      expect(readManifest(target, ".json")).toStrictEqual({
        version: 1,
        files: ["a.json", "guide/index.json", "z.json"],
      });
      expect(readManifest(target, ".md")).toStrictEqual({
        version: 1,
        files: ["a.md", "guide/README.md", "z.md"],
      });
    } finally {
      removeDir(root);
    }
  });

  it("does not delete anything on the first run and removes stale outputs on the next run", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      writeFileSync(path.join(source, "b.yml"), "b: 2\n");
      writeFileSync(path.join(target, "stale.json"), '{"stale":true}\n');

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      convertYamlFilesToJson(source, target, (data) => data);

      expect(existsSync(path.join(target, "stale.json"))).toBe(true);
      expect(readManifest(target, ".json").files).toStrictEqual(["a.json", "b.json"]);

      rmSync(path.join(source, "b.yml"));
      writeFileSync(path.join(source, "c.yml"), "c: 3\n");

      convertYamlFilesToJson(source, target, (data) => data);
      warnSpy.mockRestore();

      expect(existsSync(path.join(target, "b.json"))).toBe(false);
      expect(existsSync(path.join(target, "stale.json"))).toBe(true);
      expect(readManifest(target, ".json").files).toStrictEqual(["a.json", "c.json"]);
      expect(getManifestNames(target)).toHaveLength(1);
    } finally {
      removeDir(root);
    }
  });

  it("keeps outputs generated by another source sharing the same target folder", () => {
    const root = createTempDir();

    try {
      const sourceA = path.join(root, "source-a");
      const sourceB = path.join(root, "source-b");
      const target = path.join(root, "target");
      mkdirSync(sourceA, { recursive: true });
      mkdirSync(sourceB, { recursive: true });

      writeFileSync(path.join(sourceA, "a.yml"), "a: 1\n");
      writeFileSync(path.join(sourceB, "b.yml"), "b: 2\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(sourceA, target, (data) => data);
        convertYamlFilesToJson(sourceB, target, (data) => data);

        rmSync(path.join(sourceA, "a.yml"));
        convertYamlFilesToJson(sourceA, target, (data) => data);

        // A 的清理不能删除 B 仍记录的输出；此处立即断言，避免被随后 B 的重跑掩盖
        expect(existsSync(path.join(target, "a.json"))).toBe(false);
        expect(existsSync(path.join(target, "b.json"))).toBe(true);

        convertYamlFilesToJson(sourceB, target, (data) => data);
      } finally {
        warnSpy.mockRestore();
      }

      expect(existsSync(path.join(target, "a.json"))).toBe(false);
      expect(readFileSync(path.join(target, "b.json"), "utf-8")).toBe('{"b":2}');
      expect(getManifestNames(target)).toHaveLength(2);
    } finally {
      removeDir(root);
    }
  });

  it("does not delete a path still claimed by another source manifest", () => {
    const root = createTempDir();

    try {
      const sourceA = path.join(root, "source-a");
      const sourceB = path.join(root, "source-b");
      const target = path.join(root, "target");
      mkdirSync(sourceA, { recursive: true });
      mkdirSync(sourceB, { recursive: true });

      writeFileSync(path.join(sourceA, "shared.yml"), "from: a\n");
      writeFileSync(path.join(sourceB, "shared.yml"), "from: b\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(sourceA, target, (data) => data);
        convertYamlFilesToJson(sourceB, target, (data) => data);

        rmSync(path.join(sourceA, "shared.yml"));
        convertYamlFilesToJson(sourceA, target, (data) => data);
      } finally {
        warnSpy.mockRestore();
      }

      expect(readFileSync(path.join(target, "shared.json"), "utf-8")).toBe('{"from":"b"}');
    } finally {
      removeDir(root);
    }
  });

  it("does not delete files outside the target through a directory symlink", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      const outside = path.join(root, "outside");
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });
      mkdirSync(outside, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      writeFileSync(path.join(outside, "keep.json"), '{"keep":true}\n');
      writeFileSync(path.join(outside, "victim.json"), '{"victim":true}\n');

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(source, target, (data) => data);

        symlinkSync(outside, path.join(target, "linked"), "dir");

        rmSync(path.join(source, "a.yml"));

        convertYamlFilesToJson(source, target, (data) => data);
      } finally {
        warnSpy.mockRestore();
      }

      // 清理只按清单删除，不会遍历符号链接目录，因此目标文件夹之外的文件一个都不能少
      expect(existsSync(path.join(outside, "keep.json"))).toBe(true);
      expect(existsSync(path.join(outside, "victim.json"))).toBe(true);
      expect(lstatSync(path.join(target, "linked")).isSymbolicLink()).toBe(true);
      expect(existsSync(path.join(target, "a.json"))).toBe(false);
      expect(readManifest(target, ".json").files).toStrictEqual([]);
    } finally {
      removeDir(root);
    }
  });

  it("skips a manifest path that resolves outside the target through a symlink", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      const outside = path.join(root, "outside");
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });
      mkdirSync(outside, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      writeFileSync(path.join(outside, "keep.json"), '{"keep":true}\n');
      writeFileSync(path.join(outside, "victim.json"), '{"victim":true}\n');

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(source, target, (data) => data);

        symlinkSync(outside, path.join(target, "linked"), "dir");

        rmSync(path.join(source, "a.yml"));

        // 模拟清单被写入一个经由符号链接指向目标文件夹之外的路径
        writeManifest(target, ".json", ["a.json", "linked/victim.json"]);

        convertYamlFilesToJson(source, target, (data) => data);
      } finally {
        warnSpy.mockRestore();
      }

      expect(existsSync(path.join(target, "linked", "keep.json"))).toBe(true);
      expect(existsSync(path.join(outside, "keep.json"))).toBe(true);
      expect(existsSync(path.join(outside, "victim.json"))).toBe(true);
      expect(lstatSync(path.join(target, "linked")).isSymbolicLink()).toBe(true);
      expect(existsSync(path.join(target, "a.json"))).toBe(false);
      expect(readManifest(target, ".json").files).toStrictEqual([]);
    } finally {
      removeDir(root);
    }
  });

  it("keeps the index.yml to README.md mapping when removing stale markdown", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(path.join(source, "guide"), { recursive: true });

      writeFileSync(path.join(source, "guide", "index.yml"), "title: 指南\n");

      convertYamlFilesToMarkdown(source, () => "# 指南\n", target);

      expect(readFileSync(path.join(target, "guide", "README.md"), "utf-8")).toBe("# 指南\n");
      expect(readManifest(target, ".md").files).toStrictEqual(["guide/README.md"]);

      rmSync(path.join(source, "guide", "index.yml"));
      convertYamlFilesToMarkdown(source, () => "# 指南\n", target);

      expect(existsSync(path.join(target, "guide", "README.md"))).toBe(false);
      expect(readManifest(target, ".md").files).toStrictEqual([]);
    } finally {
      removeDir(root);
    }
  });

  it("keeps the public removeStaleOutputs API conservative without a manifest", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });
      mkdirSync(target, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      writeFileSync(path.join(source, "b.yml"), "b: 2\n");
      writeFileSync(path.join(target, "a.json"), '{"a":1}\n');
      writeFileSync(path.join(target, "b.json"), '{"b":2}\n');
      writeFileSync(path.join(target, "manual.json"), '{"manual":true}\n');

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        removeStaleOutputs(source, target, ".json");

        expect(existsSync(path.join(target, "a.json"))).toBe(true);
        expect(existsSync(path.join(target, "b.json"))).toBe(true);
        expect(existsSync(path.join(target, "manual.json"))).toBe(true);
        expect(readManifest(target, ".json").files).toStrictEqual(["a.json", "b.json"]);

        rmSync(path.join(source, "b.yml"));
        removeStaleOutputs(source, target, ".json");
      } finally {
        warnSpy.mockRestore();
      }

      expect(existsSync(path.join(target, "a.json"))).toBe(true);
      expect(existsSync(path.join(target, "b.json"))).toBe(false);
      expect(existsSync(path.join(target, "manual.json"))).toBe(true);
      expect(listOutputs(target)).toStrictEqual(["a.json", "manual.json"]);
    } finally {
      removeDir(root);
    }
  });

  describe("tampered generation manifests", () => {
    const tamperCases: { name: string; buildFiles: (victim: string) => string[] }[] = [
      { name: "a parent-relative path", buildFiles: () => ["a.json", "../victim.json"] },
      {
        name: "a Windows-style parent-relative path",
        buildFiles: () => ["a.json", String.raw`..\victim.json`],
      },
      { name: "an absolute path", buildFiles: (victim) => ["a.json", victim] },
      { name: "a bare parent directory", buildFiles: () => ["a.json", ".."] },
      { name: "an empty path", buildFiles: () => ["a.json", ""] },
      { name: "a path containing NUL", buildFiles: () => ["a.json", "a\0.json"] },
      {
        name: "mixed valid and invalid paths",
        buildFiles: () => ["a.json", "z.json", "../victim.json"],
      },
    ];

    it.each(tamperCases)("treats a manifest containing $name as corrupt", ({ buildFiles }) => {
      const root = createTempDir();

      try {
        const source = path.join(root, "source");
        const target = path.join(root, "target");
        const victim = path.join(root, "victim.json");
        mkdirSync(source, { recursive: true });

        writeFileSync(path.join(source, "a.yml"), "a: 1\n");
        writeFileSync(path.join(source, "z.yml"), "z: 1\n");
        writeFileSync(victim, '{"victim":true}\n');

        const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

        try {
          convertYamlFilesToJson(source, target, (data) => data);
          expect(readManifest(target, ".json").files).toStrictEqual(["a.json", "z.json"]);

          rmSync(path.join(source, "a.yml"));
          writeManifest(target, ".json", buildFiles(victim));
          warnSpy.mockClear();

          convertYamlFilesToJson(source, target, (data) => data);

          const warnings = getWarnings(warnSpy);

          // 清单含任一非法路径时按整体损坏处理（all-or-nothing），本次不删除任何输出
          expect(existsSync(path.join(target, "a.json"))).toBe(true);
          expect(existsSync(path.join(target, "z.json"))).toBe(true);
          expect(existsSync(victim)).toBe(true);
          expect(warnings.some((message) => message.includes("生成清单包含无效路径"))).toBe(true);
          expect(warnings.some((message) => message.includes("已移除陈旧的输出文件"))).toBe(false);

          // 清单被重写为本次生成集，非法项不会残留
          expect(readManifest(target, ".json").files).toStrictEqual(["z.json"]);
        } finally {
          warnSpy.mockRestore();
        }
      } finally {
        removeDir(root);
      }
    });

    const corruptManifestCases: {
      name: string;
      corrupt: (filename: string) => void;
      warning: string;
    }[] = [
      {
        name: "malformed JSON",
        corrupt: (filename) => writeFileSync(filename, "{\n"),
        warning: "无法读取生成清单",
      },
      {
        name: "an unsupported version",
        corrupt: (filename) =>
          writeFileSync(filename, `${JSON.stringify({ version: 2, files: [] })}\n`),
        warning: "生成清单格式无效",
      },
      {
        name: "a non-array file list",
        corrupt: (filename) =>
          writeFileSync(filename, `${JSON.stringify({ version: 1, files: "a.json" })}\n`),
        warning: "生成清单格式无效",
      },
      {
        name: "a renamed manifest",
        corrupt: (filename) => renameSync(filename, `${filename}.bak`),
        warning: "缺少生成清单",
      },
    ];

    it.each(corruptManifestCases)(
      "does not clean when the manifest has $name",
      ({ corrupt, warning }) => {
        const root = createTempDir();

        try {
          const source = path.join(root, "source");
          const target = path.join(root, "target");
          mkdirSync(source, { recursive: true });

          writeFileSync(path.join(source, "a.yml"), "a: 1\n");
          writeFileSync(path.join(source, "z.yml"), "z: 1\n");

          const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

          try {
            convertYamlFilesToJson(source, target, (data) => data);

            rmSync(path.join(source, "a.yml"));
            corrupt(getManifestFilename(target, ".json"));
            warnSpy.mockClear();

            convertYamlFilesToJson(source, target, (data) => data);

            const warnings = getWarnings(warnSpy);

            expect(existsSync(path.join(target, "a.json"))).toBe(true);
            expect(existsSync(path.join(target, "z.json"))).toBe(true);
            expect(warnings.some((message) => message.includes(warning))).toBe(true);
            expect(warnings.some((message) => message.includes("已移除陈旧的输出文件"))).toBe(
              false,
            );
            expect(readManifest(target, ".json").files).toStrictEqual(["z.json"]);
          } finally {
            warnSpy.mockRestore();
          }
        } finally {
          removeDir(root);
        }
      },
    );
  });

  it("uses one manifest for symlinked aliases of the same source", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const alias = path.join(root, "source-alias");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      symlinkSync(source, alias, "dir");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(source, target, (data) => data);
        convertYamlFilesToJson(alias, target, (data) => data);
      } finally {
        warnSpy.mockRestore();
      }

      // 同一个物理源的别名必须共用一个清单，否则两个清单会互相保护
      expect(getManifestNames(target)).toHaveLength(1);
      expect(readManifest(target, ".json").files).toStrictEqual(["a.json"]);
      expect(existsSync(path.join(target, "a.json"))).toBe(true);
    } finally {
      removeDir(root);
    }
  });

  it("skips cleanup when another manifest in a shared target is unreadable", () => {
    const root = createTempDir();

    try {
      const sourceA = path.join(root, "source-a");
      const sourceB = path.join(root, "source-b");
      const target = path.join(root, "target");
      mkdirSync(sourceA, { recursive: true });
      mkdirSync(sourceB, { recursive: true });

      writeFileSync(path.join(sourceA, "shared.yml"), "from: a\n");
      writeFileSync(path.join(sourceB, "shared.yml"), "from: b\n");

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(sourceA, target, (data) => data);
        const [manifestA] = getManifestNames(target);

        convertYamlFilesToJson(sourceB, target, (data) => data);
        const manifestB = getOtherManifest(target, manifestA);

        // B 的清单损坏后，A 无法确认 shared.json 是否仍被 B 使用，必须放弃清理
        writeFileSync(path.join(target, manifestB), "{\n");
        rmSync(path.join(sourceA, "shared.yml"));
        warnSpy.mockClear();

        convertYamlFilesToJson(sourceA, target, (data) => data);

        const warnings = getWarnings(warnSpy);

        expect(readFileSync(path.join(target, "shared.json"), "utf-8")).toBe('{"from":"b"}');
        expect(
          warnings.some((message) => message.includes("目标文件夹中存在无法读取的生成清单")),
        ).toBe(true);
        expect(warnings.some((message) => message.includes("已移除陈旧的输出文件"))).toBe(false);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      removeDir(root);
    }
  });

  it("removes a previous output when its source becomes empty or is skipped", () => {
    const root = createTempDir();

    try {
      const source = path.join(root, "source");
      const target = path.join(root, "target");
      mkdirSync(source, { recursive: true });

      writeFileSync(path.join(source, "a.yml"), "a: 1\n");
      writeFileSync(path.join(source, "b.yml"), "b: 2\n");

      const { convert, skip } = createSkippingConverter();

      const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

      try {
        convertYamlFilesToJson(source, target, convert);
        expect(readManifest(target, ".json").files).toStrictEqual(["a.json", "b.json"]);

        // 空 YAML 被跳过后不进入清单，上次的 b.json 会在本次按陈旧输出删除
        writeFileSync(path.join(source, "b.yml"), "# 只有注释\n");
        convertYamlFilesToJson(source, target, convert);
        expect(existsSync(path.join(target, "b.json"))).toBe(false);
        expect(readManifest(target, ".json").files).toStrictEqual(["a.json"]);

        writeFileSync(path.join(source, "b.yml"), "b: 2\n");
        convertYamlFilesToJson(source, target, convert);
        expect(existsSync(path.join(target, "b.json"))).toBe(true);

        // 转换函数返回 null 时同样跳过并清理旧输出
        skip("b");
        convertYamlFilesToJson(source, target, convert);
        expect(existsSync(path.join(target, "b.json"))).toBe(false);
        expect(readManifest(target, ".json").files).toStrictEqual(["a.json"]);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      removeDir(root);
    }
  });
});
