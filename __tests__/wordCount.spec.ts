import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getFolderPageWordCount,
  getJSONValue,
  getJSONWordCount,
  getPageWordCount,
  getWordNumber,
} from "../src/helpers/wordCount.js";
import type { ComponentOptions, PageConfig } from "../src/page/schema.js";

describe(getWordNumber, () => {
  it("should count English words", () => {
    expect(getWordNumber("hello world")).toBe(2);
    expect(getWordNumber("one two three four five")).toBe(5);
  });

  it("should count Chinese characters", () => {
    expect(getWordNumber("你好世界")).toBe(4);
    expect(getWordNumber("中文")).toBe(2);
  });

  it("should count mixed content", () => {
    expect(getWordNumber("hello 你好 world")).toBe(4);
  });

  it("should return 0 for empty string", () => {
    expect(getWordNumber("")).toBe(0);
  });

  it("should count single word", () => {
    expect(getWordNumber("hello")).toBe(1);
  });

  it("should handle whitespace only", () => {
    expect(getWordNumber("   ")).toBe(0);
  });

  it("should handle punctuation between words", () => {
    expect(getWordNumber("hello, world")).toBe(2);
  });

  it("should handle Cyrillic characters", () => {
    expect(getWordNumber("Привет мир")).toBe(2);
  });
});

describe(getJSONValue, () => {
  it("should convert numbers to strings", () => {
    expect(getJSONValue(42)).toBe("42");
    expect(getJSONValue(3.14)).toBe("3.14");
  });

  it("should return strings as-is", () => {
    expect(getJSONValue("hello")).toBe("hello");
  });

  it("should handle arrays", () => {
    expect(getJSONValue(["a", "b", "c"])).toBe("a, b, c");
  });

  it("should handle nested objects", () => {
    const result = getJSONValue({ key1: "value1", key2: "value2" });

    expect(result).toContain("value1");
    expect(result).toContain("value2");
  });

  it("should handle null", () => {
    expect(getJSONValue(null)).toBe("");
  });

  it("should handle nested arrays and objects", () => {
    const result = getJSONValue({
      items: ["text1", "text2"],
      nested: { key: "value" },
    });

    expect(result).toContain("text1");
    expect(result).toContain("text2");
    expect(result).toContain("value");
  });

  it("should handle boolean values", () => {
    expect(getJSONValue(true)).toBe("");
    expect(getJSONValue(false)).toBe("");
  });

  it("should handle empty object", () => {
    expect(getJSONValue({})).toBe("");
  });
});

describe(getPageWordCount, () => {
  it("should count page title, desc and summary", () => {
    const page = {
      title: "学校介绍",
      desc: "东北师范大学简介",
      summary: "学校概况与招生信息",
      content: [],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("学校介绍") +
        getWordNumber("东北师范大学简介") +
        getWordNumber("学校概况与招生信息"),
    );
  });

  it("should not count cite", () => {
    const page = {
      title: "长春轨道交通",
      cite: "http://www.ccqg.com/yyxl",
      content: [{ tag: "title", text: "轨道交通总线路图" } satisfies ComponentOptions],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("长春轨道交通") + getWordNumber("轨道交通总线路图"),
    );
  });

  it("should not count author, icon, time, id and keywords", () => {
    const page = {
      title: "测试",
      author: "Mr.Hope",
      icon: "flow",
      time: "2026-08-07T12:16:59.941Z",
      id: "some-id",
      keywords: ["关键词一", "关键词二"],
      content: [],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("测试"));
  });

  it("should count text component header and text", () => {
    const page = {
      title: "页面",
      content: [
        { tag: "text", header: "段落标题", text: "这是段落文字" } satisfies ComponentOptions,
        { tag: "p", text: ["第一段", "第二段"] } satisfies ComponentOptions,
        { tag: "ul", header: false, text: ["列表项一", "列表项二"] } satisfies ComponentOptions,
        { tag: "ol", text: "单一列表项" } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("页面") +
        getWordNumber("段落标题") +
        getWordNumber("这是段落文字") +
        getWordNumber("第一段") +
        getWordNumber("第二段") +
        getWordNumber("列表项一") +
        getWordNumber("列表项二") +
        getWordNumber("单一列表项"),
    );
  });

  it("should count img desc but not src", () => {
    const page = {
      title: "图片页",
      content: [
        {
          tag: "img",
          src: "$img/traffic/ccqg/railway-line.png",
          desc: "总线路图",
        } satisfies ComponentOptions,
        { tag: "img", src: "https://example.com/image.png" } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("图片页") + getWordNumber("总线路图"));
  });

  it("should count list item text and desc but not icon and url", () => {
    const page = {
      title: "列表页",
      content: [
        {
          tag: "list",
          header: "列表标题",
          items: [
            { text: "列表文字", desc: "列表描述", icon: "notice", url: "/pages/detail?id=1" },
            { text: "另一项" },
          ],
          footer: "列表页脚",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("列表页") +
        getWordNumber("列表标题") +
        getWordNumber("列表文字") +
        getWordNumber("列表描述") +
        getWordNumber("另一项") +
        getWordNumber("列表页脚"),
    );
  });

  it("should count grid header, item text and footer but not icon and path", () => {
    const page = {
      title: "网格页",
      content: [
        {
          tag: "grid",
          header: "网格标题",
          items: [{ text: "网格文字", icon: "notice", path: "graduate/" }],
          footer: "网格页脚",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("网格页") +
        getWordNumber("网格标题") +
        getWordNumber("网格文字") +
        getWordNumber("网格页脚"),
    );
  });

  it("should count card title, desc and name but not url and images", () => {
    const page = {
      title: "卡片页",
      content: [
        {
          tag: "card",
          title: "卡片标题",
          desc: "卡片描述",
          name: "卡片名称",
          cover: "https://example.com/cover.png",
          logo: "flow",
          url: "/pages/detail?id=1",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("卡片页") +
        getWordNumber("卡片标题") +
        getWordNumber("卡片描述") +
        getWordNumber("卡片名称"),
    );
  });

  it("should count table caption, header and body", () => {
    const page = {
      title: "表格页",
      content: [
        {
          tag: "table",
          caption: "表格标题",
          header: ["姓名", "学号"],
          body: [
            ["张三", "20230001"],
            ["李四", "20230002"],
          ],
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("表格页") +
        getWordNumber("表格标题") +
        getWordNumber("姓名") +
        getWordNumber("学号") +
        getWordNumber("张三") +
        getWordNumber("20230001") +
        getWordNumber("李四") +
        getWordNumber("20230002"),
    );
  });

  it("should count phone text fields but not numbers, wechat, site and mail", () => {
    const page = {
      title: "电话页",
      content: [
        {
          tag: "phone",
          header: "联系电话",
          num: 12345678901,
          fName: "张",
          lName: "三",
          org: "教务处",
          remark: "办公时间咨询",
          nick: "张三",
          wechat: "zhangsan",
          province: "吉林省",
          city: "长春市",
          street: "人民大街",
          postCode: 130000,
          site: "https://www.nenu.edu.cn",
          mail: "zhangsan@nenu.edu.cn",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("电话页") +
        getWordNumber("联系电话") +
        getWordNumber("张") +
        getWordNumber("三") +
        getWordNumber("教务处") +
        getWordNumber("办公时间咨询") +
        getWordNumber("张三") +
        getWordNumber("吉林省") +
        getWordNumber("长春市") +
        getWordNumber("人民大街"),
    );
  });

  it("should count account text fields but not qq, wxid, mail, site and loc", () => {
    const page = {
      title: "账户页",
      content: [
        {
          tag: "account",
          name: "东北师范大学",
          detail: "官方公众号",
          desc: "校园信息发布",
          logo: "$img/logo.png",
          qq: 123456789,
          qqcode: "$img/qq.png",
          wxid: "nenu",
          account: "nenu-official",
          loc: "43.86283,125.33014",
          mail: "admin@nenu.edu.cn",
          site: "https://www.nenu.edu.cn",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("账户页") +
        getWordNumber("东北师范大学") +
        getWordNumber("官方公众号") +
        getWordNumber("校园信息发布"),
    );
  });

  it("should count location names and details but not loc and path", () => {
    const page = {
      title: "地点页",
      content: [
        {
          tag: "location",
          header: "校内地点",
          points: [
            {
              loc: "43.86283,125.33014",
              name: "图书馆",
              detail: "开放时间 8:00-22:00",
              path: "map/library",
            },
          ],
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("地点页") +
        getWordNumber("校内地点") +
        getWordNumber("图书馆") +
        getWordNumber("开放时间 8:00-22:00"),
    );
  });

  it("should count video title and danmu text but not src and poster", () => {
    const page = {
      title: "视频页",
      content: [
        {
          tag: "video",
          src: "$file/video/intro.mp4",
          title: "迎新视频",
          poster: "https://example.com/poster.png",
          danmuList: [{ text: "欢迎新同学", color: "#fff", time: 1 }],
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("视频页") + getWordNumber("迎新视频") + getWordNumber("欢迎新同学"),
    );
  });

  it("should count audio name but not src, poster and author", () => {
    const page = {
      title: "音频页",
      content: [
        {
          tag: "audio",
          src: "$file/audio/bgm.mp3",
          name: "校歌",
          author: "某歌手",
          poster: "https://example.com/poster.png",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("音频页") + getWordNumber("校歌"));
  });

  it("should not count footer cite and author but count desc", () => {
    const page = {
      title: "页脚页",
      content: [
        {
          tag: "footer",
          author: "Mr.Hope",
          desc: "数据来自官网",
          cite: ["https://example.com/source"],
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("页脚页") + getWordNumber("数据来自官网"));
  });

  it("should count doc name but not url", () => {
    const page = {
      title: "文档页",
      content: [
        { tag: "doc", name: "新生手册", url: "$file/doc/handbook.pdf" } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("文档页") + getWordNumber("新生手册"));
  });

  it("should count action content", () => {
    const page = {
      title: "动作页",
      content: [
        {
          tag: "action",
          header: "紧急通知",
          content: "请同学们注意安全",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("动作页") + getWordNumber("紧急通知") + getWordNumber("请同学们注意安全"),
    );
  });

  it("should count functional-list text, desc and picker select", () => {
    const page = {
      title: "设置页",
      content: [
        {
          tag: "functional-list",
          header: "通用设置",
          items: [
            { type: "switch", text: "夜间模式", desc: "开启后减少夜间刺眼", key: "night" },
            { type: "picker", text: "选择校区", select: ["本部校区", "净月校区"], key: "campus" },
          ],
          footer: "设置页脚",
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(
      getWordNumber("设置页") +
        getWordNumber("通用设置") +
        getWordNumber("夜间模式") +
        getWordNumber("开启后减少夜间刺眼") +
        getWordNumber("选择校区") +
        getWordNumber("本部校区") +
        getWordNumber("净月校区") +
        getWordNumber("设置页脚"),
    );
  });

  it("should not count carousel", () => {
    const page = {
      title: "轮播页",
      content: [
        {
          tag: "carousel",
          images: ["https://example.com/1.png", "https://example.com/2.png"],
        } satisfies ComponentOptions,
      ],
    } satisfies PageConfig;

    expect(getPageWordCount(page)).toBe(getWordNumber("轮播页"));
  });

  it("should return 0 for invalid page", () => {
    expect(getPageWordCount({} as unknown as PageConfig)).toBe(0);
    expect(getPageWordCount(undefined as unknown as PageConfig)).toBe(0);
  });
});

describe(getFolderPageWordCount, () => {
  it("should count page text in a folder excluding cite and image links", () => {
    const testDir = mkdtempSync(path.join(tmpdir(), "wordCount-folder-test-"));
    const originalCwd = process.cwd();

    try {
      writeFileSync(
        path.join(testDir, "page1.json"),
        JSON.stringify({
          title: "页面一",
          desc: "页面描述",
          cite: "https://example.com/source",
          content: [
            { tag: "title", text: "标题一" },
            { tag: "img", src: "$img/a.png", desc: "图片描述" },
          ],
        }),
      );
      writeFileSync(
        path.join(testDir, "page2.json"),
        JSON.stringify({
          title: "页面二",
          content: [{ tag: "text", text: "正文内容" }],
        }),
      );

      process.chdir(testDir);

      expect(getFolderPageWordCount(".")).toBe(
        getWordNumber("页面一") +
          getWordNumber("页面描述") +
          getWordNumber("标题一") +
          getWordNumber("图片描述") +
          getWordNumber("页面二") +
          getWordNumber("正文内容"),
      );
    } finally {
      process.chdir(originalCwd);
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should return 0 for folder without json files", () => {
    const testDir = mkdtempSync(path.join(tmpdir(), "wordCount-empty-test-"));
    const originalCwd = process.cwd();

    try {
      writeFileSync(path.join(testDir, "note.txt"), "hello world");

      process.chdir(testDir);

      expect(getFolderPageWordCount(".")).toBe(0);
    } finally {
      process.chdir(originalCwd);
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe(getJSONWordCount, () => {
  it("should count all JSON content including links", () => {
    const testDir = mkdtempSync(path.join(tmpdir(), "wordCount-json-test-"));
    const originalCwd = process.cwd();

    try {
      writeFileSync(
        path.join(testDir, "page.json"),
        JSON.stringify({
          title: "测试",
          cite: "https://example.com/source",
          content: [{ tag: "img", src: "$img/a.png" }],
        }),
      );

      process.chdir(testDir);

      // 原始行为：getJSONWordCount 统计 JSON 中的全部文本（包括引用来源与图片链接）。
      // 拼接后的内容为 " 测试 https://example.com/source  img $img/a.png"，
      // 即 测试(2) + https/example.com/source(3) + img(1) + img(1) + a.png(1) = 8。
      expect(getJSONWordCount(".")).toBe(8);

      // 应多于只统计正文的 getFolderPageWordCount（仅标题 测试 计入）
      expect(getJSONWordCount(".")).toBeGreaterThan(getFolderPageWordCount("."));
    } finally {
      process.chdir(originalCwd);
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
