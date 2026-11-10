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

  it("writes block scalar targets and multiline values as valid block scalars", () => {
    expect(
      updateYamlScalar("time: |\n  2020-01-01\ntitle: x\n", "time", "2026-11-10T09:00:00.000Z"),
    ).toBe("time: |-\n  2026-11-10T09:00:00.000Z\ntitle: x\n");
    expect(updateYamlScalar("time: >\n  2020-01-01\ntitle: x\n", "time", "2026-11-10")).toBe(
      "time: |-\n  2026-11-10\ntitle: x\n",
    );
    expect(updateYamlScalar("time: 2020-01-01\n", "time", "a\nb")).toBe("time: |-\n  a\n  b\n");
  });

  it("keeps the raw scalar contract for empty and CRLF values", () => {
    expect(updateYamlScalar("time: 2020-01-01\n", "time", "")).toBe("time: \n");
    // CRLF 值使用双引号转义，避免块标量中出现裸 CR
    expect(updateYamlScalar("time: 2020-01-01\n", "time", "a\r\nb")).toBe('time: "a\\r\n\n  b"\n');
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
