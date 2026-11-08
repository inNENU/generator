import { describe, expect, it } from "vitest";

import { getPageJSON } from "../src/page/json.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

// 生成一个覆盖多种组件、无日期与绝对路径的稳定页面。
// 不包含 path 组件，避免校验阶段依赖 cwd 下的页面文件。
const createPage = (): PageConfig => ({
  title: "校园卡服务指南",
  desc: "校园卡办理、挂失与充值说明",
  summary: "供 AI 索引使用的摘要",
  keywords: ["校园卡", "挂失"],
  campus: "本部校区",
  aiPriority: 3,
  author: ["后勤管理处", "信息中心"],
  cite: ["https://example.com/card-guide"],
  content: [
    { tag: "title", text: "校园卡服务" },
    { tag: "text", header: "办理流程", text: ["携带证件前往服务大厅", "填写申请表并提交"] },
    { tag: "ul", header: "所需材料", text: ["身份证原件", "学生证复印件"] },
    {
      tag: "list",
      header: "服务网点",
      items: [
        { text: "本部校区服务点", desc: "工作日开放" },
        { text: "净月校区服务点", url: "card-branch" },
      ],
    },
    { tag: "card", title: "网上服务大厅", desc: "在线办理挂失", url: "card-online" },
    { tag: "doc", name: "校园卡申请表", url: "https://example.com/files/card-form.pdf" },
    { tag: "phone", header: "咨询电话", fName: "老师", lName: "张", num: "0431-85099999" },
    {
      tag: "action",
      header: "下载申请表",
      content: "https://example.com/files/card-form.pdf",
    },
    {
      tag: "table",
      caption: "服务时间",
      header: ["校区", "时间"],
      body: [
        ["本部", "8:00-17:00"],
        ["净月", "9:00-16:00"],
      ],
    },
  ],
});

// 站点管线的 URL 转换器：只转换测试页面中带 card- 前缀的链接
const siteUrlConverter = (url: string): string | null =>
  url.startsWith("card-") ? `https://example.com/${url}` : null;

// 文本管线的 URL 转换器：同时给出小程序与网页地址
const textUrlConverter = (url: string): { miniapp: string; web: string } | null =>
  url.startsWith("card-") ? { miniapp: `/pages/${url}`, web: `https://example.com/${url}` } : null;

// 返回顺序检查中发现的问题，空数组表示片段齐全且顺序正确
const collectOrderProblems = (text: string, fragments: string[]): string[] => {
  const problems: string[] = [];
  let previousIndex = -1;

  for (const fragment of fragments) {
    const index = text.indexOf(fragment);

    if (index === -1) problems.push(`缺少片段: ${fragment}`);
    else if (index <= previousIndex) problems.push(`片段顺序不正确: ${fragment}`);
    else previousIndex = index;
  }

  return problems;
};

describe("页面管线", () => {
  it("站点 Markdown 渲染 frontmatter 与关键组件片段", () => {
    const markdown = getPageMarkdown(createPage(), {
      location: "guide/card",
      urlConverter: siteUrlConverter,
    });

    expect(markdown.startsWith("---\ntitle: 校园卡服务指南\n")).toBe(true);
    expect(markdown).toContain("author:\n  - 后勤管理处\n  - 信息中心");
    expect(markdown).toContain("cite:\n  - https://example.com/card-guide");
    expect(markdown).not.toContain("isOriginal: true");
    expect(markdown).toContain("::: info 咨询电话");
    expect(markdown).toContain('class="innenu-doc"');
    expect(markdown).toContain('<div class="innenu-card-title">网上服务大厅</div>');
    expect(markdown).toContain(
      '<a class="innenu-list-item" href="https://example.com/card-branch" target="_blank">',
    );
  });

  it("站点 Markdown 渲染卡片链接、文档名与表格", () => {
    const markdown = getPageMarkdown(createPage(), {
      location: "guide/card",
      urlConverter: siteUrlConverter,
    });

    expect(markdown).toContain(
      '<a class="innenu-card" href="https://example.com/card-online" target="_blank">',
    );
    expect(markdown).toContain("校园卡申请表.pdf");
    expect(markdown).toContain("| 校区 | 时间 |\n| :-: | :-: |");
    expect(markdown).toContain("</div>");
  });

  it("站点 Markdown 保持组件顺序且描述位于末尾", () => {
    const markdown = getPageMarkdown(createPage(), {
      location: "guide/card",
      urlConverter: siteUrlConverter,
    });

    expect(
      collectOrderProblems(markdown, [
        "title: 校园卡服务指南",
        "## 校园卡服务",
        "### 办理流程",
        "携带证件前往服务大厅",
        "### 所需材料",
        "#### 服务网点 {.innenu-list-header}",
        "本部校区服务点",
        "网上服务大厅",
        'class="innenu-doc"',
        "::: info 咨询电话",
        "#### 下载申请表",
        "### 服务时间",
        "> 校园卡办理、挂失与充值说明",
      ]),
    ).toStrictEqual([]);
  });

  it("文本 Markdown（web）使用小程序优先链接并保留组件顺序", () => {
    const text = getPageText(createPage(), "guide/card", { urlConverter: textUrlConverter });

    expect(text.startsWith("# 校园卡服务指南")).toBe(true);
    expect(text).toContain("> 描述: 校园卡办理、挂失与充值说明");
    expect(text).toContain(
      "- 净月校区服务点（小程序：`/pages/card-branch`，[网页版](https://example.com/card-branch)）",
    );
    expect(text).toContain(
      "- 网上服务大厅（小程序：`/pages/card-online`，[网页版](https://example.com/card-online)）",
    );
    expect(text).toContain("- [校园卡申请表.pdf](https://example.com/files/card-form.pdf)");
    expect(text).toContain("- 电话: [0431-85099999](tel:0431-85099999)");
    expect(text).toContain("| 本部 | 8:00-17:00 |");

    expect(
      collectOrderProblems(text, [
        "# 校园卡服务指南",
        "> 描述: 校园卡办理、挂失与充值说明",
        "## 校园卡服务",
        "### 办理流程",
        "携带证件前往服务大厅",
        "### 所需材料",
        "- 身份证原件",
        "#### 服务网点",
        "- 本部校区服务点 - 工作日开放",
        "- 净月校区服务点",
        "- 网上服务大厅",
        "- [校园卡申请表.pdf]",
        "#### 咨询电话",
        "#### 下载申请表",
        "### 服务时间",
      ]),
    ).toStrictEqual([]);
  });

  it("文本 Markdown（miniapp）只输出小程序链接，action 使用容器语法", () => {
    const text = getPageText(createPage(), "guide/card", {
      mode: "miniapp",
      urlConverter: textUrlConverter,
    });

    expect(text).toContain("- 净月校区服务点（小程序：`/pages/card-branch`）");
    expect(text).toContain("- 网上服务大厅（小程序：`/pages/card-online`）");
    expect(text).not.toContain("[网页版]");
    expect(text).not.toContain("https://example.com/card-branch");
    expect(text).toContain(
      "#### 下载申请表\n\n::: action\n[下载申请表](https://example.com/files/card-form.pdf)\n:::",
    );
    expect(text).toContain("### 服务时间");
    expect(text).toContain("- 电话: [0431-85099999](tel:0431-85099999)");
  });

  it("文本 Markdown（web）把多行描述逐行渲染为引用块", () => {
    // 与资源仓 pages/newcomer/contact/fellow.yml 的 5 行 desc 结构一致；测试直接构造 PageConfig，不读取资源仓文件。
    const descLines = [
      "如需补充或申请替换群聊，请联系 QQ: 1178522294",
      "申请替换需满足以下条件：",
      "· 群内该地区的东北师大在校生人数不少于 50 人；",
      "· 原群主失联且活跃管理员少于两人，或申请替换的群聊活跃度显著高于原群聊（满足其一即可）；",
      "· 允许 Mr.Hope 加入群聊以进行核验。",
    ];
    const page: PageConfig = {
      title: "老乡群",
      desc: descLines.join("\n"),
      content: [{ tag: "title", text: "东北师范大学老乡群" }],
    };

    const text = getPageText(page, "newcomer/contact/fellow");
    const outputLines = text.split("\n");
    const expectedDesc = [
      `> 描述: ${descLines[0]}`,
      ...descLines.slice(1).map((line) => `> ${line}`),
    ].join("\n>\n");

    expect(text).toContain(`${expectedDesc}\n\n## 东北师范大学老乡群`);

    const expectedLines = [
      `> 描述: ${descLines[0]}`,
      ...descLines.slice(1).map((line) => `> ${line}`),
    ];

    expect(outputLines).toStrictEqual(expect.arrayContaining(expectedLines));
    // 每一行描述都必须带 `> ` 前缀，不能有退化成普通正文的裸行
    expect(outputLines.filter((line) => descLines.includes(line))).toStrictEqual([]);
  });

  it("getPageJSON 生成稳定的页面数据快照且不泄漏 AI 专用字段", () => {
    const json = getPageJSON(createPage(), "guide/card");

    expect(json).toMatchSnapshot();

    expect(json.id).toBe("guide/card");
    expect(json.author).toBe("后勤管理处、信息中心");
    expect(json.cite).toStrictEqual(["https://example.com/card-guide"]);
    expect(json).not.toHaveProperty("summary");
    expect(json).not.toHaveProperty("keywords");
    expect(json).not.toHaveProperty("campus");
    expect(json).not.toHaveProperty("aiPriority");
  });
});
