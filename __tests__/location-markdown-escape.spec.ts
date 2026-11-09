import { describe, expect, it, vi } from "vitest";

import { getLocationMarkdown, getLocationMarkerUrl } from "../src/components/location/markdown.js";
import type { LocationComponentOptions } from "../src/components/location/schema.js";
import { getPageMarkdown } from "../src/page/markdown.js";
import type { PageConfig } from "../src/page/schema.js";
import { locSchema } from "../src/schema/index.js";

/** 含 HTML 属性语法的恶意坐标 */
const injections = [
  '1,2" onload="alert(1)',
  "<svg onload=alert(1)>",
  "1,2&quot; onload=&quot;alert(1)",
] as const;

const pointsOf = (loc: string): LocationComponentOptions["points"] => [
  { loc, name: "n", detail: "d" },
];

const componentOf = (loc: string): LocationComponentOptions =>
  ({
    tag: "location",
    header: "h",
    points: pointsOf(loc),
  }) as unknown as LocationComponentOptions;

const pageOf = (loc: string): PageConfig => ({
  title: "t",
  content: [componentOf(loc)],
});

const decodeHtml = (value: string): string =>
  value
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const getIframe = (output: string): string => /<iframe\b[^>]*>/u.exec(output)?.[0] ?? "";

const getAttributeNames = (output: string): string[] =>
  [...getIframe(output).matchAll(/\s(?<name>[\w-]+)="[^"]*"/gu)].map(
    (match) => match.groups?.name ?? "",
  );

const getAttribute = (output: string, name: string): string =>
  new RegExp(String.raw`\s${name}="([^"]*)"`, "u").exec(getIframe(output))?.[1] ?? "";

describe("location iframe src attribute escaping", () => {
  // 恶意 loc 在生成站点 Markdown 时不能逃逸 src 属性
  it.each(injections)("escapes injected markup in src for %s", (loc) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const output = getLocationMarkdown(componentOf(loc));

      // 只有组件自身声明的属性，注入内容不会变成 onload 等新属性
      expect(getAttributeNames(output)).toStrictEqual([
        "class",
        "src",
        "frameborder",
        "width",
        "height",
      ]);
      expect(output).not.toMatch(/\sonload="[^"]*"/u);
      expect(output).not.toContain("<svg");

      // src 语义保持不变：实体解码后与原地图链接一致，坐标逗号未被编码
      const src = getAttribute(output, "src");

      expect(src).toContain("coord:");
      expect(decodeHtml(src)).toBe(getLocationMarkerUrl(pointsOf(loc)));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it.each(injections)("escapes injected markup through getPageMarkdown for %s", (loc) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      for (const options of [{ mode: "web" as const }, { mode: "web" as const, check: false }]) {
        const output = getPageMarkdown(pageOf(loc), options);

        expect(getAttributeNames(output)).toStrictEqual([
          "class",
          "src",
          "frameborder",
          "width",
          "height",
        ]);
        expect(output).not.toMatch(/\sonload="[^"]*"/u);
        expect(output).not.toContain("<svg");
      }
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("keeps the src attribute valid when loc contains entity-like text", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const output = getLocationMarkdown(componentOf("1,2&quot; onload=&quot;alert(1)"));

      // &quot; 会被二次转义，不能还原成可执行的属性边界
      expect(output).toContain("&amp;quot;");
      expect(output).not.toMatch(/\sonload="/u);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("escapes the query separators exactly once for valid coordinates", () => {
    const points = [{ loc: "43.862016,125.33606", name: "A&B", detail: "C<D>" }];
    const output = getLocationMarkdown({
      tag: "location",
      header: "h",
      points,
    });

    // 合法数据只做 HTML 实体转义，解码后仍是同一个地图链接
    expect(output).toContain("&amp;marker=");
    expect(output).not.toContain("&amp;amp;");
    expect(decodeHtml(getAttribute(output, "src"))).toBe(getLocationMarkerUrl(points));
  });
});

describe("location schema rejects HTML syntax in loc", () => {
  it("rejects every injection payload", () => {
    expect(injections.map((loc) => locSchema.safeParse(loc).success)).toStrictEqual([
      false,
      false,
      false,
    ]);
  });

  it("still accepts real coordinates", () => {
    expect(locSchema.safeParse("43.862016,125.33606").success).toBe(true);
    expect(locSchema.safeParse("43.8,125.3").success).toBe(true);
  });
});
