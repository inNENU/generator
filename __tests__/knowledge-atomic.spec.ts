import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { generateKnowledgeContent, generateKnowledgeIndex } from "../src/knowledge.js";

/**
 * 递归收集文件夹下的所有文件
 *
 * @param folder 文件夹路径
 * @param prefix 结果中的路径前缀
 * @returns 文件相对路径列表
 */
const listFiles = (folder: string, prefix = ""): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);

    if (entry.isDirectory()) files.push(...listFiles(entryPath, `${prefix}${entry.name}/`));
    else files.push(`${prefix}${entry.name}`);
  }

  return files;
};

describe("knowledge 解析与原子写入", () => {
  const originalCwd = process.cwd();
  const testDir = path.join(tmpdir(), "knowledge-atomic-test");

  const setup = (): void => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(path.join(testDir, "pages/guide"), { recursive: true });
    mkdirSync(path.join(testDir, "dist"), { recursive: true });

    writeFileSync(
      path.join(testDir, "pages/guide/valid.yml"),
      ["title: 正常页面", "content:", "  - tag: text", "    text: 正文"].join("\n"),
    );

    process.chdir(testDir);
  };

  const teardown = (): void => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  };

  it("跳过空文件与纯注释页面，并输出带路径的错误", () => {
    setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      writeFileSync(path.join(testDir, "pages/guide/empty.yml"), "");
      writeFileSync(
        path.join(testDir, "pages/guide/comment.yml"),
        ["# 只有注释", "---", "# 还是注释", "..."].join("\n"),
      );

      generateKnowledgeContent("./pages", "./dist");
      generateKnowledgeIndex("./pages", "./dist", { format: "json" });

      expect(existsSync(path.join(testDir, "dist/guide/empty.md"))).toBe(false);
      expect(existsSync(path.join(testDir, "dist/guide/comment.md"))).toBe(false);
      expect(readFileSync(path.join(testDir, "dist/guide/valid.md"), "utf-8")).toBe(
        "# 正常页面\n\n正文",
      );

      const messages = errorSpy.mock.calls.map((args) => args.join(" "));

      expect(messages.some((message) => message.includes("guide/empty.yml"))).toBe(true);
      expect(messages.some((message) => message.includes("guide/comment.yml"))).toBe(true);
      expect(messages.some((message) => message.includes("页面配置为空"))).toBe(true);

      const index = readFileSync(path.join(testDir, "dist/index.json"), "utf-8");

      expect(index).toContain("guide/valid");
      expect(index).not.toMatch(/empty|comment/u);
    } finally {
      errorSpy.mockRestore();
      teardown();
    }
  });

  it("拒绝别名数量超限的页面（maxAliases），不生成 Markdown 与索引项", () => {
    setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // 101 个别名超过 parseYaml 的 maxAliases（100），旧实现直接 load 会接受并展开成 102 段正文
      writeFileSync(
        path.join(testDir, "pages/guide/bomb.yml"),
        [
          "title: 别名炸弹",
          "content:",
          "  - &item",
          "    tag: text",
          "    text: 正文",
          ...Array.from({ length: 101 }, () => "  - *item"),
        ].join("\n"),
      );

      generateKnowledgeContent("./pages", "./dist");
      generateKnowledgeIndex("./pages", "./dist", { format: "json" });

      expect(existsSync(path.join(testDir, "dist/guide/bomb.md"))).toBe(false);

      const messages = errorSpy.mock.calls.map((args) => args.join(" "));

      expect(messages.some((message) => message.includes("guide/bomb.yml"))).toBe(true);
      expect(messages.some((message) => message.includes("maxAliases"))).toBe(true);

      const index = readFileSync(path.join(testDir, "dist/index.json"), "utf-8");

      expect(index).toContain("guide/valid");
      expect(index).not.toContain("bomb");
    } finally {
      errorSpy.mockRestore();
      teardown();
    }
  });

  it("原子写入成功后不留下 .tmp 文件", () => {
    setup();

    try {
      mkdirSync(path.join(testDir, "pages/newcomer"), { recursive: true });
      writeFileSync(
        path.join(testDir, "pages/newcomer/index.yml"),
        ["title: 新生专题", "content:", "  - tag: text", "    text: 新生指南"].join("\n"),
      );

      generateKnowledgeContent("./pages", "./dist");
      generateKnowledgeIndex("./pages", "./dist", { format: "json" });
      generateKnowledgeIndex("./pages", "./dist", { format: "lora" });

      const files = listFiles(path.join(testDir, "dist"));

      expect(files).toContain("guide/valid.md");
      expect(files).toContain("newcomer/index.md");
      expect(files).toContain("index.json");
      expect(files).toContain("index.lora");
      expect(files.some((file) => file.includes(".tmp"))).toBe(false);
    } finally {
      teardown();
    }
  });

  it("正常页面生成结果保持不变", () => {
    setup();

    try {
      generateKnowledgeContent("./pages", "./dist");
      generateKnowledgeIndex("./pages", "./dist", { format: "json" });

      expect(readFileSync(path.join(testDir, "dist/guide/valid.md"), "utf-8")).toBe(
        "# 正常页面\n\n正文",
      );
      expect(readFileSync(path.join(testDir, "dist/index.json"), "utf-8")).toBe(
        '[\n  {\n    "path": "guide/valid",\n    "info": "正常页面"\n  }\n]',
      );
    } finally {
      teardown();
    }
  });
});
