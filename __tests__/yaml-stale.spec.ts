import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
  readdirSync(dir).filter((filename) => filename.startsWith(MANIFEST_PREFIX));

const readManifest = (dir: string, extension: ".json" | ".md"): GenerationManifest => {
  const prefix = `${MANIFEST_PREFIX}${extension.slice(1)}.`;
  const filename = getManifestNames(dir).find((name) => name.startsWith(prefix));

  if (!filename) throw new Error(`未找到 ${extension} 生成清单: ${dir}`);

  return JSON.parse(readFileSync(path.join(dir, filename), "utf-8")) as GenerationManifest;
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

  it("does not follow symbolic links while cleaning and never deletes outside the target", () => {
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
        const [manifestName] = getManifestNames(target);
        expect(manifestName).toBeDefined();

        const manifestFilename = path.join(target, manifestName);
        const manifest = readManifest(target, ".json");

        writeFileSync(
          manifestFilename,
          `${JSON.stringify(
            { version: manifest.version, files: [...manifest.files, "linked/victim.json"] },
            null,
            2,
          )}\n`,
        );

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
});
