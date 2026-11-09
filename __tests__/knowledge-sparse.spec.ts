// oxlint-disable vitest/no-hooks -- 每个用例都需要重置生成器配置、工作目录与临时目录

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, resetConfig } from "../src/config.js";
import { isAssetFileCheckEnabled, withoutAssetFileCheck } from "../src/helpers/assetCheck.js";
import { generateKnowledgeContent, generateKnowledgeIndex } from "../src/knowledge.js";

const originalCwd = process.cwd();

/** 记录需要清理的临时目录 */
const tempFolders: string[] = [];

const createTempFolder = (): string => {
  const folder = mkdtempSync(path.join(tmpdir(), "innenu-knowledge-sparse-"));

  tempFolders.push(folder);

  return folder;
};

/**
 * 写入页面 YAML
 *
 * @param folder 临时目录
 * @param relativePath 相对临时目录的页面路径
 * @param lines YAML 行
 */
const writePage = (folder: string, relativePath: string, lines: string[]): void => {
  const filePath = path.join(folder, relativePath);

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
};

/**
 * 列出目录下所有文件的相对路径（统一使用 `/`，便于断言）
 *
 * @param folder 目标目录
 * @returns 排序后的相对文件路径
 */
const listFiles = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(folder, entry.name);

      return entry.isDirectory()
        ? listFiles(entryPath).map((item) => `${entry.name}/${item}`)
        : [entry.name];
    })
    .sort();

/**
 * 写入引用 `$img` / `$file` 的页面
 *
 * 只在模拟稀疏检出的临时目录中写入页面，不写入对应的 `img/`、`file/` 资源。
 *
 * @param folder 临时目录
 */
const writeAssetPages = (folder: string): void => {
  writePage(folder, "pages/guide/image.yml", [
    "title: 图片页",
    "content:",
    "  - tag: img",
    "    src: $img/guide/photo.png",
    "    desc: 校园照片",
    "  - tag: text",
    "    text: 图片页正文",
  ]);
  writePage(folder, "pages/guide/doc.yml", [
    "title: 文档页",
    "content:",
    "  - tag: doc",
    "    name: 通知单",
    "    url: $file/docs/notice.pdf",
  ]);
  writePage(folder, "pages/intro/plain.yml", [
    "title: 普通页",
    "content:",
    "  - tag: text",
    "    text: 普通正文",
  ]);
};

/**
 * 写入真正非法的页面（缺少标题、缺少正文、字段类型错误）
 *
 * @param folder 临时目录
 */
const writeInvalidPages = (folder: string): void => {
  writePage(folder, "pages/guide/empty-title.yml", [
    'title: ""',
    "content:",
    "  - tag: text",
    "    text: 非法正文",
  ]);
  writePage(folder, "pages/guide/no-content.yml", ["title: 缺少正文"]);
  writePage(folder, "pages/guide/wrong-type.yml", ["title: 类型错误", "content: 应该是数组"]);
};

describe("知识库生成与稀疏检出", () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
    process.chdir(originalCwd);

    for (const folder of tempFolders) rmSync(folder, { recursive: true, force: true });

    tempFolders.length = 0;
  });

  it("稀疏检出下含 $img/$file 的页面全部生成，且不再报告页面配置校验失败", () => {
    const folder = createTempFolder();

    writeAssetPages(folder);
    process.chdir(folder);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // 页面跳转路径校验依赖 pageFolder，指向临时页面目录
    config({ pageFolder: "./pages" });

    generateKnowledgeContent("./pages", "./dist");
    generateKnowledgeIndex("./pages", "./dist");

    // 含资源引用的页面与普通页面都应产出（资源文件本身不存在）
    expect(listFiles(path.join(folder, "dist"))).toStrictEqual([
      "guide/doc.md",
      "guide/image.md",
      "index.lora",
      "intro/plain.md",
    ]);

    // 不应出现资源缺失导致的页面配置校验失败
    expect(errorSpy).not.toHaveBeenCalled();

    const imageContent = readFileSync(path.join(folder, "dist/guide/image.md"), "utf-8");

    expect(imageContent).toMatch(/!\[校园照片\]\(\/img\/guide\/photo\.png\)[\s\S]*图片页正文/u);

    const docContent = readFileSync(path.join(folder, "dist/guide/doc.md"), "utf-8");

    expect(docContent).toMatch(/通知单\.pdf\]\(\/file\/docs\/notice\.pdf\)/u);

    const index = readFileSync(path.join(folder, "dist/index.lora"), "utf-8");

    expect(["guide/image", "guide/doc", "intro/plain"].every((item) => index.includes(item))).toBe(
      true,
    );

    // 生成结束后同步开关必须恢复
    expect(isAssetFileCheckEnabled()).toBe(true);
  });

  it("资源文件存在时产出与稀疏检出逐字节一致", () => {
    const folder = createTempFolder();

    writeAssetPages(folder);
    process.chdir(folder);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    config({ pageFolder: "./pages" });

    // 资源不存在：稀疏检出
    generateKnowledgeContent("./pages", "./sparse-dist");
    generateKnowledgeIndex("./pages", "./sparse-dist");

    // 补齐资源文件：完整检出
    mkdirSync(path.join(folder, "img/guide"), { recursive: true });
    writeFileSync(path.join(folder, "img/guide/photo.png"), "fake png");
    mkdirSync(path.join(folder, "file/docs"), { recursive: true });
    writeFileSync(path.join(folder, "file/docs/notice.pdf"), "fake pdf");

    generateKnowledgeContent("./pages", "./full-dist");
    generateKnowledgeIndex("./pages", "./full-dist");

    expect(errorSpy).not.toHaveBeenCalled();

    const sparseFiles = listFiles(path.join(folder, "sparse-dist"));
    const fullFiles = listFiles(path.join(folder, "full-dist"));

    expect(fullFiles).toStrictEqual(sparseFiles);

    for (const file of fullFiles) {
      expect(readFileSync(path.join(folder, "full-dist", file), "utf-8")).toBe(
        readFileSync(path.join(folder, "sparse-dist", file), "utf-8"),
      );
    }
  });

  it("真正非法的页面仍被跳过并逐个报告，不会进入产物", () => {
    const folder = createTempFolder();

    writeAssetPages(folder);
    writeInvalidPages(folder);
    process.chdir(folder);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    config({ pageFolder: "./pages" });

    generateKnowledgeContent("./pages", "./dist");
    generateKnowledgeIndex("./pages", "./dist");

    // 合法页面（即使资源缺失）照常生成，非法页面不产出
    expect(listFiles(path.join(folder, "dist"))).toStrictEqual([
      "guide/doc.md",
      "guide/image.md",
      "index.lora",
      "intro/plain.md",
    ]);

    const messages = errorSpy.mock.calls.map((args) => args.map(String).join(" "));
    const validationMessages = messages.filter((message) => message.includes("页面配置校验失败"));

    // 内容生成与索引生成各处理一遍，每个非法页面各报告一次
    expect(validationMessages).toHaveLength(6);
    expect(
      ["guide/empty-title.yml", "guide/no-content.yml", "guide/wrong-type.yml"].every((item) =>
        validationMessages.some((message) => message.includes(item)),
      ),
    ).toBe(true);

    // 合法页面的资源引用不应产生资源缺失日志
    expect(messages.join("\n")).not.toMatch(/\$(?:img|file)/u);

    const index = readFileSync(path.join(folder, "dist/index.lora"), "utf-8");

    expect(["empty-title", "no-content", "wrong-type"].some((item) => index.includes(item))).toBe(
      false,
    );
  });

  it("生成过程抛出异常时也会恢复资源文件存在性校验", () => {
    const folder = createTempFolder();

    process.chdir(folder);

    expect(isAssetFileCheckEnabled()).toBe(true);

    // getFileList 在目录不存在时抛错，异常必须穿透 withoutAssetFileCheck 的 finally
    expect(() => generateKnowledgeContent("./missing-pages", "./dist")).toThrow(/目录不存在/u);
    expect(isAssetFileCheckEnabled()).toBe(true);

    expect(() => generateKnowledgeIndex("./missing-pages", "./dist")).toThrow(/目录不存在/u);
    expect(isAssetFileCheckEnabled()).toBe(true);

    // 回调内部确实处于关闭状态，抛错后恢复
    expect(() =>
      withoutAssetFileCheck(() => {
        expect(isAssetFileCheckEnabled()).toBe(false);

        throw new Error("模拟异常");
      }),
    ).toThrow("模拟异常");
    expect(isAssetFileCheckEnabled()).toBe(true);
  });
});
