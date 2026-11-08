import { describe, expect, it, vi } from "vitest";

import { getAccountMarkdown } from "../src/components/account/markdown.js";
import type { AccountComponentOptions } from "../src/components/account/schema.js";
import { getActionMarkdown } from "../src/components/action/markdown.js";
import type { ActionComponentOptions } from "../src/components/action/schema.js";
import { getCardMarkdown } from "../src/components/card/markdown.js";
import type { CardComponentOptions } from "../src/components/card/schema.js";
import { getDocMarkdown } from "../src/components/doc/markdown.js";
import type { DocComponentOptions } from "../src/components/doc/schema.js";
import { getGridMarkdown } from "../src/components/grid/markdown.js";
import type { GridComponentOptions } from "../src/components/grid/schema.js";
import { getImgMarkdown } from "../src/components/img/markdown.js";
import type { ImageComponentOptions } from "../src/components/img/schema.js";
import { getListMarkdown } from "../src/components/list/markdown.js";
import type { ListComponentOptions } from "../src/components/list/schema.js";
import { getLocationMarkdown } from "../src/components/location/markdown.js";
import type { LocationComponentOptions } from "../src/components/location/schema.js";
import { getPhoneMarkdown } from "../src/components/phone/markdown.js";
import type { PhoneComponentOptions } from "../src/components/phone/schema.js";
import { getTableMarkdown } from "../src/components/table/markdown.js";
import type { TableComponentOptions } from "../src/components/table/schema.js";
import { getTextMarkdown } from "../src/components/text/markdown.js";
import type { TextComponentOptions } from "../src/components/text/schema.js";
import type { PageConfig } from "../src/page/schema.js";
import { getPageText } from "../src/page/text.js";

const payload = `a & b < c "d" <script>alert("x")</script>`;

const expectEscaped = (output: string): void => {
  expect(output).not.toContain("<script>");
  expect(output).toContain("&lt;script&gt;");
  expect(output).toContain("&amp;");
  expect(output).toContain("&lt;");
  expect(output).toContain("&quot;");
};

describe("markdown text escaping", () => {
  it("escapes account name, detail and description", () => {
    // account logo 为本地图片，校验时会打印文件不存在错误，测试中静音
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const output = getAccountMarkdown({
      tag: "account",
      name: payload,
      logo: "$img/logo.png",
      detail: payload,
      desc: payload,
    } as unknown as AccountComponentOptions);

    errorSpy.mockRestore();

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes card title, name and description", () => {
    const output = getCardMarkdown({
      tag: "card",
      title: payload,
      name: payload,
      desc: payload,
      path: "guide/about",
    } as unknown as CardComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes list header, footer, item text and description", () => {
    const output = getListMarkdown({
      tag: "list",
      header: payload,
      footer: payload,
      items: [{ text: payload, desc: payload }],
    } as unknown as ListComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes grid header, footer and item text", () => {
    const output = getGridMarkdown({
      tag: "grid",
      header: payload,
      footer: payload,
      items: [{ text: payload, icon: "https://example.com/icon.png", path: "guide/about" }],
    } as unknown as GridComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes text header and paragraph text", () => {
    const output = getTextMarkdown({
      tag: "p",
      header: payload,
      text: payload,
    } as unknown as TextComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes phone header and every contact text field", () => {
    const output = getPhoneMarkdown({
      tag: "phone",
      header: payload,
      fName: payload,
      lName: payload,
      num: 13800138000,
      org: payload,
      remark: payload,
      nick: payload,
      title: payload,
      province: payload,
      city: payload,
      street: payload,
      postCode: "130000",
      mail: "contact@example.com",
      site: "https://example.com",
    } as unknown as PhoneComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes table caption, header and body cells", () => {
    const output = getTableMarkdown({
      tag: "table",
      caption: payload,
      header: [payload],
      body: [[payload]],
    } as unknown as TableComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes location header", () => {
    const output = getLocationMarkdown({
      tag: "location",
      header: payload,
      points: [{ loc: "116.397,39.909", name: payload, detail: payload }],
    } as unknown as LocationComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes doc name", () => {
    const output = getDocMarkdown({
      tag: "doc",
      name: payload,
      url: "https://example.com/file.pdf",
    } as unknown as DocComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes image description", () => {
    const output = getImgMarkdown({
      tag: "img",
      src: "https://example.com/image.png",
      desc: payload,
    } as unknown as ImageComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes action header and link label", () => {
    const output = getActionMarkdown({
      tag: "action",
      header: payload,
      content: "https://example.com",
    } as unknown as ActionComponentOptions);

    expect(output).not.toBe("");
    expectEscaped(output);
  });

  it("escapes page title, description and text content", () => {
    const page = {
      title: `a & <script>"x"</script>`,
      desc: payload,
      content: [{ tag: "text", text: payload }],
    } as unknown as PageConfig;

    const output = getPageText(page, "guide/about");

    expect(output).not.toBe("");
    expectEscaped(output);
  });
});
