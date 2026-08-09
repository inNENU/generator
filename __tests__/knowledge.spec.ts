import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateKnowledgeContent, generateKnowledgeIndex } from "../src/index.js";

/**
 * 测试用 urlConverter：转换 notice-detail 链接（999999 除外），其他返回 null
 *
 * @param url 待转换的原始链接
 * @returns 转换结果或 null
 */
const testUrlConverter = (url: string): { miniapp: string; web: string } | null => {
  if (!url.startsWith("notice-detail")) return null;

  const target = /info\/(?<id>[^&]+)/u.exec(url)?.groups?.id;

  if (!target || target.includes("999999")) return null;

  return {
    miniapp: url,
    web: `https://m-443.webvpn.nenu.edu.cn/${target}`,
  };
};

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

    // 带 url 的 list 页面（测试 urlConverter）
    writeFileSync(
      path.join(testDir, "pages/guide/notice.yml"),
      [
        "title: 通知",
        "content:",
        "  - tag: list",
        "    items:",
        "      - text: 可转换链接",
        "        url: notice-detail?url=info/1031/255432.htm&title=公告",
        "      - text: 被丢弃链接",
        "        url: notice-detail?url=info/1031/999999.htm",
        "      - text: 无链接项",
        "        desc: 说明文字",
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
        generateKnowledgeIndex("./pages", "./dist", { format: "json" });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        expect(json).toStrictEqual([
          // 缺省不排序：按文件创建顺序（guide → newcomer → other），仅低优先级排最后
          {
            path: "guide/card",
            info: "校园卡办理、挂失与充值指南",
            keywords: ["办卡", "挂失", "充值"],
            campus: "本部校区",
          },
          { path: "guide/index", info: "东师指南" },
          { path: "guide/multi", info: "第一行内容\n第二行内容" },
          { path: "guide/notice", info: "通知" },
          { path: "newcomer/index", info: "新生专题" },
          { path: "other/about", info: "关于" },
          // 低优先级（负数）排最后
          { path: "apartment/office", info: "办公室", priority: -1 },
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
        generateKnowledgeIndex("./pages", "./dist", { format: "yaml" });

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
    it("缺省不传 options 时输出 index.lora", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist");

        const lora = readFileSync(path.join(testDir, "dist/index.lora"), {
          encoding: "utf-8",
        });

        expect(lora).toContain("guide/card");
        expect(lora).toContain("校园卡办理、挂失与充值指南");
        expect(lora).not.toContain("secret");
      } finally {
        teardown();
      }
    });

    it("输出 index.lora，path/title 无前缀，可选字段仅在有值时输出，记录间空行分隔", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", { format: "lora" });

        const lora = readFileSync(path.join(testDir, "dist/index.lora"), { encoding: "utf-8" });

        expect(lora).toBe(
          [
            // 缺省不排序：按文件创建顺序（guide → newcomer → other）
            "guide/card",
            // 有 summary：summary 取代 title 行
            "校园卡办理、挂失与充值指南",
            "keywords: [办卡, 挂失, 充值]",
            "campus: 本部校区",
            "",
            "guide/index",
            // 无 summary：输出 title 行
            "东师指南",
            "",
            "guide/multi",
            // 有 summary：summary 取代 title 行
            "第一行内容 第二行内容",
            "",
            "guide/notice",
            // 无 summary：输出 title 行
            "通知",
            "",
            "newcomer/index",
            "新生专题",
            "",
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
        generateKnowledgeIndex("./pages", "./dist", { format: "lora" });

        const lora = readFileSync(path.join(testDir, "dist/index.lora"), { encoding: "utf-8" });

        expect(lora).not.toContain("secret");
      } finally {
        teardown();
      }
    });
  });

  describe("排序", () => {
    it("缺省不排序，保持文件列表原始顺序（仅按优先级分组）", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", { format: "json" });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // 不传 sorter：按文件创建顺序（guide → newcomer → other），仅低优先级排最后
        expect(paths[0]).toBe("guide/card");
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("newcomer/index"));
        expect(paths.indexOf("newcomer/index")).toBeLessThan(paths.indexOf("other/about"));
        // 低优先级最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("传入路径数组时按一级目录排序，未列出的目录排最后", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", {
          format: "json",
          sorter: ["newcomer", "guide", "school", "intro", "apartment"],
        });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // 高优先级：newcomer 在 guide 前，other（未列出）在最后
        expect(paths.indexOf("newcomer/index")).toBeLessThan(paths.indexOf("guide/card"));
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
        generateKnowledgeIndex("./pages", "./dist", { format: "json", sorter: ["guide", "other"] });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // 高优先级内：guide（order 中）在 other（order 中）前，newcomer（order 外）排最后
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("other/about"));
        expect(paths.indexOf("other/about")).toBeLessThan(paths.indexOf("newcomer/index"));
        // 低优先级（apartment/office）始终在最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("同目录内保持原有顺序（稳定排序）", () => {
      setup();
      try {
        generateKnowledgeIndex("./pages", "./dist", { format: "json" });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // guide 目录内按文件列表顺序：card → index → multi
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("guide/index"));
        expect(paths.indexOf("guide/index")).toBeLessThan(paths.indexOf("guide/multi"));
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

        generateKnowledgeIndex("./pages", "./dist", { format: "json" });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // priority: 10 排最前（高于默认 0 的所有项）
        expect(paths[0]).toBe("newcomer/top");
        expect(json[0]).toStrictEqual({ path: "newcomer/top", info: "置顶页", priority: 10 });
        // 其余 priority 0 项保持原始顺序（guide/card 最先创建）
        expect(paths[1]).toBe("guide/card");
        // 负数（apartment/office）仍在最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("路径前缀数组支持最长前缀匹配（子路径可单独定位）", () => {
      setup();
      try {
        // 新建子路径页面：newcomer/tip、school 普通页、school/international
        mkdirSync(path.join(testDir, "pages/newcomer/tip"), { recursive: true });
        writeFileSync(
          path.join(testDir, "pages/newcomer/tip/digital.yml"),
          ["title: 数码贴士", "content:", "  - tag: text", "    text: 数码"].join("\n"),
        );
        mkdirSync(path.join(testDir, "pages/school/international"), { recursive: true });
        writeFileSync(
          path.join(testDir, "pages/school/international/index.yml"),
          ["title: 国际汉学院", "content:", "  - tag: text", "    text: 汉学院"].join("\n"),
        );
        writeFileSync(
          path.join(testDir, "pages/school/math.yml"),
          ["title: 数学学院", "content:", "  - tag: text", "    text: 数学"].join("\n"),
        );

        // 把 newcomer/tip 与 school/international 排在 apartment 之后（降权）
        generateKnowledgeIndex("./pages", "./dist", {
          format: "json",
          sorter: [
            "newcomer",
            "guide",
            "school",
            "intro",
            "apartment",
            "newcomer/tip",
            "school/international",
          ],
        });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // newcomer 下普通页面匹配 newcomer（靠前）
        expect(paths.indexOf("newcomer/index")).toBeLessThan(paths.indexOf("guide/card"));
        // school 普通页匹配 school（位置 2），newcomer/tip 匹配 newcomer/tip（位置 5）→ school 在 tip 前
        expect(paths.indexOf("school/math")).toBeLessThan(paths.indexOf("newcomer/tip/digital"));
        // newcomer/tip（位置 5）在 school/international（位置 6）前
        expect(paths.indexOf("newcomer/tip/digital")).toBeLessThan(
          paths.indexOf("school/international/index"),
        );
        // 低优先级（apartment/office 是 -1）始终在最后
        expect(paths[paths.length - 1]).toBe("apartment/office");
      } finally {
        teardown();
      }
    });

    it("支持传入自定义函数 sorter", () => {
      setup();
      try {
        // 自定义：newcomer 排最后（默认它最前）
        const sorter = (a: { path: string }, b: { path: string }): number =>
          Number(a.path.startsWith("newcomer")) - Number(b.path.startsWith("newcomer"));

        generateKnowledgeIndex("./pages", "./dist", { format: "json", sorter });

        const json = JSON.parse(
          readFileSync(path.join(testDir, "dist/index.json"), { encoding: "utf-8" }),
        ) as Record<string, unknown>[];

        const paths = json.map((item) => item.path as string);

        // guide 在 newcomer 前（自定义 sorter 让 newcomer 排后）
        expect(paths.indexOf("guide/card")).toBeLessThan(paths.indexOf("newcomer/index"));
      } finally {
        teardown();
      }
    });
  });

  describe("urlConverter", () => {
    it("generateKnowledgeContent 转换 list 中带 url 的项，null 返回时丢弃该项", () => {
      setup();
      try {
        generateKnowledgeContent("./pages", "./dist", { urlConverter: testUrlConverter });

        const content = readFileSync(path.join(testDir, "dist/guide/notice.md"), {
          encoding: "utf-8",
        });

        // 可转换链接：输出小程序优先格式
        expect(content).toContain(
          "- 可转换链接（小程序：`notice-detail?url=info/1031/255432.htm&title=公告`，[网页版](https://m-443.webvpn.nenu.edu.cn/1031/255432.htm)）",
        );
        // 被丢弃链接（999999）：不输出
        expect(content).not.toContain("999999");
        // 无 url 项：保持原格式输出
        expect(content).toContain("- 无链接项 - 说明文字");
      } finally {
        teardown();
      }
    });

    it("不传 urlConverter 时带 url 的 list 项被丢弃，无 url 项保留", () => {
      setup();
      try {
        generateKnowledgeContent("./pages", "./dist");

        const content = readFileSync(path.join(testDir, "dist/guide/notice.md"), {
          encoding: "utf-8",
        });

        // 无 urlConverter：带 url 的项无法转换，被丢弃
        expect(content).not.toContain("可转换链接");
        expect(content).not.toContain("被丢弃链接");
        // 无 url 项：保留原样输出
        expect(content).toContain("- 无链接项 - 说明文字");
      } finally {
        teardown();
      }
    });
  });
});
