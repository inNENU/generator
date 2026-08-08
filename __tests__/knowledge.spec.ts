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

    // 排序测试页面（不同一级目录）
    mkdirSync(path.join(testDir, "pages/newcomer"), { recursive: true });
    writeFileSync(
      path.join(testDir, "pages/newcomer/index.yml"),
      ["title: 新生专题", "content:", "  - tag: text", "    text: 新生指南"].join("\n"),
    );
    mkdirSync(path.join(testDir, "pages/other"), { recursive: true });
    writeFileSync(
      path.join(testDir, "pages/other/about.yml"),
      ["title: 关于", "content:", "  - tag: text", "    text: 关于页面"].join("\n"),
    );
    mkdirSync(path.join(testDir, "pages/apartment"), { recursive: true });
    writeFileSync(
      path.join(testDir, "pages/apartment/office.yml"),
      ["title: 办公室", "aiPriority: -1", "content:", "  - tag: text", "    text: 办公室信息"].join(
        "\n",
      ),
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
          // 排序：高优先级按 newcomer > guide > other（order 外目录最后）
          { path: "newcomer/README", title: "新生专题" },
          {
            path: "guide/card",
            title: "校园卡",
            summary: "校园卡办理、挂失与充值指南",
            keywords: ["办卡", "挂失", "充值"],
            campus: "本部校区",
          },
          { path: "guide/README", title: "东师指南" },
          { path: "guide/multi", title: "多行摘要", summary: "第一行内容\n第二行内容\n" },
          { path: "other/about", title: "关于" },
          // 低优先级（负数）排最后
          { path: "apartment/office", title: "办公室", priority: -1 },
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
            // 高优先级块：newcomer 在最前
            "newcomer/README",
            "新生专题",
            "",
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
            // order 外目录（other）排高优先级块最后
            "other/about",
            "关于",
            "",
            "# 低优先级（次要参考）",
            "",
            // 低优先级块：apartment 目录
            "apartment/office",
            "办公室",
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

  describe("排序", () => {
    it("默认按 newcomer > guide > school > intro > apartment，未列出的目录排最后", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "json");

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // 高优先级：newcomer 在 guide 前，other（order 外）在最后
        expect(paths.indexOf("newcomer/README")).toBeLessThan(paths.indexOf("guide/card"));
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("other/about"));
        // 低优先级最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("自定义 order 生效", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "json", ["guide", "other"]);

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // 高优先级内：guide（order 中）在 other（order 中）前，newcomer（order 外）排最后
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("other/about"));
        expect(paths.indexOf("other/about")).toBeLessThan(paths.indexOf("newcomer/README"));
        // 低优先级（apartment/office）始终在最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("同目录内保持原有顺序（稳定排序）", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", "json");

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // guide 目录内按文件列表顺序：card → README → multi
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("guide/README"));
        expect(paths.indexOf("guide/README")).toBeLessThan(paths.indexOf("guide/multi"));
      } finally {
        teardown();
      }
    });

    it("数字优先级越大越靠前，负数归入低优先级块", () => {
      setup();
      try {
        // 新增一个高优先级页面（priority: 10）与一个默认页面（无 aiPriority）
        mkdirSync(path.join(testDir, "pages/newcomer"), { recursive: true });
        writeFileSync(
          path.join(testDir, "pages/newcomer/top.yml"),
          [
            "title: 置顶页",
            "aiPriority: 10",
            "content:",
            "  - tag: text",
            "    text: 最高优先级",
          ].join("\n"),
        );

        generateKnowledgeIndex("./pages", "./dist", "json");

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // priority: 10 排最前（高于默认 0 的 newcomer/README）
        expect(paths[0]).toBe("newcomer/top");
        expect(json[0]).toStrictEqual({ path: "newcomer/top", title: "置顶页", priority: 10 });
        // 默认 0 的 newcomer/README 紧随其后
        expect(paths[1]).toBe("newcomer/README");
        // 负数（apartment/office）仍在最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });
  });
});
