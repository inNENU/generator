import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { generateKnowledgeContent, generateKnowledgeIndex } from "../src/knowledge.js";

describe("knowledge 页面校验", () => {
  const originalCwd = process.cwd();
  const testDir = path.join(tmpdir(), "knowledge-validation-test");

  const setup = (): void => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(path.join(testDir, "pages/guide"), { recursive: true });
    mkdirSync(path.join(testDir, "dist"), { recursive: true });

    writeFileSync(
      path.join(testDir, "pages/guide/valid.yml"),
      ["title: 有效页面", "content:", "  - tag: text", "    text: 正文"].join("\n"),
    );
    // 缺少必填 title，不应进入产物
    writeFileSync(
      path.join(testDir, "pages/guide/missing-title.yml"),
      ["content:", "  - tag: text", "    text: 正文"].join("\n"),
    );
    // YAML 语法错误，不应中断整批转换
    writeFileSync(path.join(testDir, "pages/guide/broken.yml"), "content: [");

    process.chdir(testDir);
  };

  const teardown = (): void => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  };

  it("跳过校验失败与解析失败的页面，并输出带路径的错误", () => {
    setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      generateKnowledgeContent("./pages", "./dist");

      expect(readFileSync(path.join(testDir, "dist/guide/valid.md"), "utf-8")).toContain("正文");
      expect(() => readFileSync(path.join(testDir, "dist/guide/missing-title.md"))).toThrow(
        /ENOENT/u,
      );
      expect(() => readFileSync(path.join(testDir, "dist/guide/broken.md"))).toThrow(/ENOENT/u);

      const messages = errorSpy.mock.calls.map((args) => args.join(" "));

      expect(messages.some((message) => message.includes("guide/missing-title.yml"))).toBe(true);
      expect(messages.some((message) => message.includes("guide/broken.yml"))).toBe(true);
    } finally {
      errorSpy.mockRestore();
      teardown();
    }
  });

  it("索引只包含校验通过的页面", () => {
    setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      generateKnowledgeIndex("./pages", "./dist");
    } finally {
      errorSpy.mockRestore();
    }

    try {
      const index = readFileSync(path.join(testDir, "dist/index.lora"), "utf-8");

      expect(index).toContain("guide/valid");
      expect(index).not.toContain("missing-title");
      expect(index).not.toContain("broken");
    } finally {
      teardown();
    }
  });
});
