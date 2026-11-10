import { describe, expect, it } from "vitest";

import { updateYamlScalar } from "../src/helpers/yaml.js";

describe(updateYamlScalar, () => {
  it("replaces only the target scalar and keeps comments and blank lines", () => {
    const content = [
      "# 页面信息",
      "title: 关于",
      "",
      "time: 2024-01-01 # 最后更新",
      "content:",
      "  - tag: text",
      "    text: hi",
      "",
    ].join("\n");

    expect(updateYamlScalar(content, "time", "2024-05-01T12:00:00.000Z")).toBe(
      [
        "# 页面信息",
        "title: 关于",
        "",
        "time: 2024-05-01T12:00:00.000Z # 最后更新",
        "content:",
        "  - tag: text",
        "    text: hi",
        "",
      ].join("\n"),
    );
  });

  it("keeps the original quote style and CRLF", () => {
    expect(updateYamlScalar('title: 关于\r\ntime: "2024-01-01"\r\n', "time", "2024-05-01")).toBe(
      'title: 关于\r\ntime: "2024-05-01"\r\n',
    );
    expect(updateYamlScalar("time: '2024-01-01'\n", "time", "2024-05-01")).toBe(
      "time: '2024-05-01'\n",
    );
  });

  it("keeps block scalars and long scalars unchanged", () => {
    const content = "desc: |\n  第一行\n  第二行\ntime: 2024-01-01\n";
    const next = updateYamlScalar(content, "time", "2024-05-01");

    expect(next).toBe("desc: |\n  第一行\n  第二行\ntime: 2024-05-01\n");
  });

  it("returns null when the top-level key is missing", () => {
    expect(updateYamlScalar("title: 关于\n", "time", "2024-05-01")).toBeNull();
    // `time:` 后没有值，没有可替换的 token
    expect(updateYamlScalar("time:\n", "time", "2024-05-01")).toBeNull();
  });

  it("throws when the YAML document cannot be parsed", () => {
    expect(() => updateYamlScalar("time: [unclosed\n", "time", "2024-05-01")).toThrow(
      /YAML 解析失败/u,
    );
  });
});
