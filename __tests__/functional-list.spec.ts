import { describe, expect, it, vi } from "vitest";

import { getPageJSON } from "../src/page/json.js";
import type { PageConfig } from "../src/page/schema.js";

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

    getPageJSON(page, "guide/about", [], { check: true });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("发现非法"), expect.any(String));

    errorSpy.mockRestore();
  });
});
