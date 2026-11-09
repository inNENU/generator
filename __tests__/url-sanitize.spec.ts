// oxlint-disable no-script-url -- 安全测试需要构造危险协议样本
import { describe, expect, it } from "vitest";

import { getSafeUrl, sanitizeUrl } from "../src/helpers/url.js";

describe("url 协议校验", () => {
  it.each([
    ["https://example.com/a?b=1#c", "http"],
    ["HTTP://example.com/", "http"],
    ["/pages/main/main", "relative"],
    ["./guide/card", "relative"],
    ["../intro/index", "relative"],
    ["#section", "relative"],
    ["card-branch", "relative"],
    ["?type=search", "relative"],
    ["mailto:foo@example.com", "mailto"],
    ["mailto:foo@example.com?subject=Hello", "mailto"],
    ["tel:0431-85099999", "tel"],
    ["tel:+86 431-85099999", "tel"],
  ])("允许安全地址 %s", (url, kind) => {
    expect(getSafeUrl(url)).toStrictEqual({ url, kind });
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("去除首尾空白后输出安全地址", () => {
    expect(sanitizeUrl("  https://example.com/a  ")).toBe("https://example.com/a");
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    [" javascript:alert(1)"],
    ["\tjavascript:alert(1)"],
    ["java\tscript:alert(1)"],
    ["\u0000javascript:alert(1)"],
    ["java\u0000script:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["file:///etc/passwd"],
    ["ftp://example.com/file"],
    ["//evil.example/x"],
    [String.raw`\\evil.example\x`],
    ["https://example.com/\njavascript:alert(1)"],
    ["&#106;avascript:alert(1)"],
    ["&#x6a;avascript:alert(1)"],
    ["&#106avascript:alert(1)"],
    ["java&Tab;script:alert(1)"],
    ["javascript&colon;alert(1)"],
    ["mailto:not-an-email"],
    ["tel:javascript:alert(1)"],
    ["javascript&#x000003a;alert(1)"],
    ["javascript&#00000058;alert(1)"],
    ["javascript&#x00000000003a;alert(1)"],
    ["&#x000000000000006a;avascript:alert(1)"],
    ["&#0000000000000000106;avascript:alert(1)"],
    [""],
    ["   "],
  ])("拒绝危险地址 %s", (url) => {
    expect(getSafeUrl(url)).toBeNull();
    expect(sanitizeUrl(url)).toBeNull();
  });

  it("解码多层嵌套的命名字符引用", () => {
    let nested = "&#106;avascript:alert(1)";

    // 每层只解码最外层 `&amp;`，需要多轮才能还原 `javascript:`。
    for (let layer = 0; layer < 5; layer += 1) nested = `&amp;${nested.slice(1)}`;

    expect(sanitizeUrl(nested)).toBeNull();
  });

  it("字符引用嵌套超过轮次上限时按不安全处理", () => {
    let nested = "&#106;avascript:alert(1)";

    for (let layer = 0; layer < 12; layer += 1) nested = `&amp;${nested.slice(1)}`;

    expect(sanitizeUrl(nested)).toBeNull();
  });

  it("保留地址中的普通字符引用，不写回解码结果", () => {
    const url = "https://example.com/?a=1&amp;b=2";

    expect(getSafeUrl(url)).toStrictEqual({ url, kind: "http" });
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("拒绝空值", () => {
    expect(getSafeUrl(null)).toBeNull();
    expect(getSafeUrl(undefined)).toBeNull();
    expect(sanitizeUrl(null)).toBeNull();
  });
});
