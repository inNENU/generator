import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../src/helpers/validation.js";
import { getPageJSON } from "../src/page/json.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

describe(getPageJSON, () => {
  it("支持带 appId 的 navigator 列表项，并自动注入 target 与 openType", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const page = {
      title: "关于我们",
      content: [
        {
          tag: "functional-list",
          header: "如果你觉得 inNENU 对你有帮助",
          items: [
            {
              type: "navigator",
              text: "切换到 inNENU",
              appId: "wx33acb831ee1831a5",
              path: "pages/index/index",
            },
          ],
          footer: " ",
        },
      ],
    } as unknown as PageConfig;

    const result = getPageJSON(page, "guide/about", [], { check: true });

    expect(errorSpy).not.toHaveBeenCalled();

    expect(result.content[0]).toMatchObject({
      tag: "functional-list",
      items: [
        expect.objectContaining({
          type: "navigator",
          text: "切换到 inNENU",
          appId: "wx33acb831ee1831a5",
          // 自动注入跳转目标与开放能力
          target: "miniProgram",
          openType: "navigate",
          // 外部小程序路径不应被解析为站内路径
          path: "pages/index/index",
        }),
      ],
    });

    errorSpy.mockRestore();
  });

  it("navigator 列表项的未知字段仍会被拦截", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const page = {
      title: "关于我们",
      content: [
        {
          tag: "functional-list",
          items: [
            {
              type: "navigator",
              text: "切换到 inNENU",
              appId: "wx33acb831ee1831a5",
              bogus: "不应存在的键",
            },
          ],
        },
      ],
    } as unknown as PageConfig;

    expect(() => getPageJSON(page, "guide/about", [], { check: true })).toThrow(ValidationError);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("发现非法"), expect.any(String));

    errorSpy.mockRestore();
  });
});

// 旧实现的文本管线没有 functional-list 分支，整块内容会落到未知组件的默认处理，
// 页面只输出标题（探针页面输出恰好为 `# f`）。以下用例锁定修复后的完整输出。
describe("functional-list 文本渲染", () => {
  const textUrlConverter = (url: string): { miniapp: string; web: string } | null =>
    url.startsWith("site://")
      ? { miniapp: `/pages/${url.slice(7)}`, web: `https://example.com/${url.slice(7)}` }
      : null;

  const createPage = (content: PageConfig["content"]): PageConfig => ({
    title: "关于我们",
    desc: "页面说明",
    content,
  });

  const createFunctionalListPage = (): PageConfig =>
    createPage([
      {
        tag: "functional-list",
        header: "欢迎社团入驻本页面",
        items: [
          // 条目级 env 不应参与文本管线过滤
          {
            type: "button",
            text: "联系 Mr.Hope",
            icon: "contact",
            openType: "contact",
            env: ["wx"],
          },
          { action: "official", text: "关注公众号", username: "innenu" },
          { action: "article", text: "招新文章", url: "https://mp.weixin.qq.com/s/abc" },
          { action: "channel", text: "视频号", username: "inNENU", id: "channel-id" },
          { type: "navigator", text: "校园导航", url: "site://map" },
          { type: "navigator", text: "站点地图", path: "map/index" },
        ],
        footer: "如有疑问请联系我们",
      },
    ]);

  it("输出页面标题、描述、列表标题、条目与页脚", () => {
    const text = getPageText(createFunctionalListPage(), "guide/about", {
      urlConverter: textUrlConverter,
    });

    expect(text).toContain("# 关于我们");
    expect(text).toContain("> 描述: 页面说明");
    expect(text).toContain("#### 欢迎社团入驻本页面");
    expect(text).toContain("> 如有疑问请联系我们");
    // 条目级 env 不参与文本管线过滤
    expect(text).toContain("- 联系 Mr.Hope");
    // 不得混入站点专用语法
    expect(text).not.toContain("<div");
  });

  it("action / url / path 条目按文本管线约定输出链接", () => {
    const text = getPageText(createFunctionalListPage(), "guide/about", {
      urlConverter: textUrlConverter,
    });

    expect(text).toContain("- [关注公众号](https://open.weixin.qq.com/qr/code?username=innenu)");
    expect(text).toContain("- [招新文章](https://mp.weixin.qq.com/s/abc)");
    // 视频号没有可直接访问的网页地址，保留条目文字
    expect(text).toContain("- 视频号");
    // url 条目转换为小程序 / 网页双端形式
    expect(text).toContain("- 校园导航（小程序：`/pages/map`，[网页版](https://example.com/map)）");
    // 网页模式不输出站内 path，避免知识库出现无法访问的内部路径
    expect(text).toContain("- 站点地图");
    expect(text).not.toContain("（path: map/index）");
    expect(text).not.toContain("RouteLink");
  });

  it("所有条目都被 urlConverter 丢弃时整块不输出，不留下悬空标题", () => {
    const page = createPage([
      {
        tag: "functional-list",
        header: "工作室招新",
        items: [{ type: "navigator", text: "招新详情", url: "info?path=Ohope-studio/invite" }],
        footer: "如有疑问请联系我们",
      },
    ]);

    const text = getPageText(page, "other/hope-studio/about", { urlConverter: textUrlConverter });

    expect(text).not.toContain("工作室招新");
    expect(text).not.toContain("招新详情");
    expect(text).not.toContain("如有疑问请联系我们");
    // 该组件是页面唯一内容，整块丢弃后只剩页面标题与描述
    expect(text).toBe("# 关于我们\n\n> 描述: 页面说明");
  });

  it("仅部分条目被 urlConverter 丢弃时，标题、页脚与其余条目照常输出", () => {
    const page = createPage([
      {
        tag: "functional-list",
        header: "相关链接",
        items: [
          { type: "navigator", text: "无法转换的链接", url: "unsupported://map" },
          { type: "navigator", text: "校园导航", url: "site://map" },
        ],
        footer: "以上链接仅供参考",
      },
    ]);

    const text = getPageText(page, "guide/about", { urlConverter: textUrlConverter });

    expect(text).toContain("#### 相关链接");
    expect(text).not.toContain("无法转换的链接");
    expect(text).toContain("- 校园导航（小程序：`/pages/map`");
    expect(text).toContain("> 以上链接仅供参考");
  });

  it("article URL 含括号或空格时用尖括号包裹，链接目标不被截断", () => {
    const page = createPage([
      {
        tag: "functional-list",
        items: [
          {
            action: "article",
            text: "招新文章",
            url: "https://mp.weixin.qq.com/s/a(b) c",
          },
        ],
      },
    ]);

    const text = getPageText(page, "guide/about");

    expect(text).toContain("- [招新文章](<https://mp.weixin.qq.com/s/a(b) c>)");
  });

  it("official 用户名含空格时同样包裹链接目标", () => {
    const page = createPage([
      {
        tag: "functional-list",
        items: [{ action: "official", text: "关注公众号", username: "in nenu" }],
      },
    ]);

    const text = getPageText(page, "guide/about");

    expect(text).toContain("- [关注公众号](<https://open.weixin.qq.com/qr/code?username=in nenu>)");
  });

  it("小程序模式补充 icon / path 与小程序跳转形式", () => {
    const text = getPageText(createFunctionalListPage(), "guide/about", {
      mode: "miniapp",
      urlConverter: textUrlConverter,
    });

    expect(text).toContain("- 联系 Mr.Hope（icon: contact）");
    expect(text).toContain("- 校园导航（小程序：`/pages/map`）");
    expect(text).toContain("- 站点地图（path: map/index）");
    expect(text).not.toContain("网页版");
  });

  it("组件级 env 不含 web 时整块跳过，与其它文本组件一致", () => {
    const page = createPage([
      {
        tag: "functional-list",
        header: "仅小程序可见",
        items: [{ text: "仅小程序条目" }],
        env: ["wx"],
      },
    ]);

    for (const mode of ["web", "miniapp"] as const) {
      const text = getPageText(page, "guide/about", { mode });

      expect(text).not.toContain("仅小程序可见");
      expect(text).not.toContain("仅小程序条目");
    }
  });

  it("站点管线仍使用原有 HTML 渲染，不受文本分支影响", () => {
    const page = createPage([
      {
        tag: "functional-list",
        header: "相关链接",
        items: [
          { text: "站内页面", path: "map/index" },
          { text: "仅小程序条目", env: ["wx"] },
        ],
      },
    ]);

    const markdown = getPageMarkdown(page, { location: "guide/about" });

    expect(markdown).toContain("相关链接 {.innenu-list-header}");
    expect(markdown).toContain('<div class="innenu-list');
    expect(markdown).toContain("<RouteLink");
    // 站点管线仍按条目 env 过滤，与文本管线不同
    expect(markdown).not.toContain("仅小程序条目");
  });
});
