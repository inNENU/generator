import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateKnowledgeIndex } from "../src/index.js";

describe("knowledge 索引生成", () => {
  const originalCwd = process.cwd();

  const testDir = path.join(tmpdir(), "knowledge-test");

  const setup = (): void => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(path.join(testDir, "pages/guide"), { recursive: true });
    mkdirSync(path.join(testDir, "dist"), { recursive: true });

    // 完整字段页面
    writeFileSync(
      path.join(testDir, "pages/guide/card.yml"),
      [
        "title: 校园卡",
        "summary: 校园卡办理、挂失与充值指南",
        "keywords: [办卡, 挂失, 充值]",
        "campus: 本部校区",
        "content:",
        "  - tag: text",
        "    text: 校园卡使用说明",
      ].join("\n"),
    );

    // 只有标题的页面（跳过空字段）
    writeFileSync(
      path.join(testDir, "pages/guide/index.yml"),
      ["title: 东师指南", "content:", "  - tag: text", "    text: 指南总览"].join("\n"),
    );

    // aiIgnore 页面（应被跳过）
    writeFileSync(
      path.join(testDir, "pages/guide/secret.yml"),
      [
        "title: 隐藏页",
        "aiIgnore: true",
        "content:",
        "  - tag: text",
        "    text: 不应出现在索引中",
      ].join("\n"),
    );

    // 多行 summary（应压缩为单行）
    writeFileSync(
      path.join(testDir, "pages/guide/multi.yml"),
      [
        "title: 多行摘要",
        "summary: |",
        "  第一行内容",
        "  第二行内容",
        "content:",
        "  - tag: text",
        "    text: 正文",
      ].join("\n"),
    );

    process.chdir(testDir);
  };

  const teardown = (): void => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  };

  describe("json 格式", () => {
    it("输出 index.json 且跳过空字段与 aiIgnore 页面", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist");

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        expect(json).toStrictEqual([
          {
            path: "guide/card",
            title: "校园卡",
            summary: "校园卡办理、挂失与充值指南",
            keywords: ["办卡", "挂失", "充值"],
            campus: "本部校区",
          },
          { path: "guide/README", title: "东师指南" },
          { path: "guide/multi", title: "多行摘要", summary: "第一行内容\n第二行内容\n" },
        ]);
      } finally {
        teardown();
      }
    });
  });

  describe("yaml 格式", () => {
    it("输出 index.yaml", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "yaml");

        const yaml = readFileSync(path.join(testDir, "dist/index.yaml"), { encoding: "utf-8" });

        expect(yaml).toContain("path: guide/card");
        expect(yaml).toContain("keywords: [办卡, 挂失, 充值]");
        expect(yaml).not.toContain("secret");
      } finally {
        teardown();
      }
    });
  });

  describe("lora 格式", () => {
    it("输出 index.lora，path/title 无前缀，可选字段仅在有值时输出，记录间空行分隔", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "lora");

        const lora = readFileSync(path.join(testDir, "dist/index.lora"), { encoding: "utf-8" });

        expect(lora).toBe(
          [
            "guide/card",
            // 有 summary：summary 取代 title 行
            "校园卡办理、挂失与充值指南",
            "keywords: [办卡, 挂失, 充值]",
            "campus: 本部校区",
            "",
            "guide/README",
            // 无 summary：输出 title 行
            "东师指南",
            "",
            "guide/multi",
            // 有 summary：summary 取代 title 行
            "第一行内容 第二行内容",
            "",
          ].join("\n"),
        );
      } finally {
        teardown();
      }
    });

    it("aiIgnore 页面不出现在 lora 中", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "lora");

        const lora = readFileSync(path.join(testDir, "dist/index.lora"), { encoding: "utf-8" });

        expect(lora).not.toContain("secret");
      } finally {
        teardown();
      }
    });
  });
});
