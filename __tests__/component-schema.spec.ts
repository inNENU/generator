import { describe, expect, it } from "vitest";

import {
  accountSchema,
  actionSchema,
  audioSchema,
  cardSchema,
  carouselSchema,
  docSchema,
  footerSchema,
  gridSchema,
  imageSchema,
  listSchema,
  locationSchema,
  phoneSchema,
  tableSchema,
  textComponentSchema,
  titleSchema,
  videoSchema,
} from "../src/component-schema.js";

describe("component-schema 导出", () => {
  it("导出全部 16 个组件 schema", () => {
    for (const schema of [
      accountSchema,
      actionSchema,
      audioSchema,
      cardSchema,
      carouselSchema,
      docSchema,
      footerSchema,
      gridSchema,
      imageSchema,
      listSchema,
      locationSchema,
      phoneSchema,
      tableSchema,
      textComponentSchema,
      titleSchema,
      videoSchema,
    ])
      expect(schema.safeParse).toBeTypeOf("function");
  });

  it("account schema 可通过 safeParse 校验", () => {
    expect(accountSchema.safeParse({ tag: "account" }).success).toBe(false);
  });

  it("audio schema 可通过 safeParse 校验", () => {
    expect(audioSchema.safeParse({ tag: "audio" }).success).toBe(false);
    expect(
      audioSchema.safeParse({ tag: "audio", src: "https://example.com/demo.mp3" }).success,
    ).toBe(true);
  });

  it("carousel schema 可通过 safeParse 校验", () => {
    expect(carouselSchema.safeParse({ tag: "carousel" }).success).toBe(false);
    expect(
      carouselSchema.safeParse({
        tag: "carousel",
        images: ["https://example.com/demo.png"],
      }).success,
    ).toBe(true);
  });

  it("footer schema 可通过 safeParse 校验", () => {
    expect(footerSchema.safeParse({ tag: "footer", cite: ["not-a-url"] }).success).toBe(false);
    expect(footerSchema.safeParse({ tag: "footer" }).success).toBe(true);
  });

  it("grid schema 可通过 safeParse 校验", () => {
    expect(gridSchema.safeParse({ tag: "grid", items: [] }).success).toBe(false);
    expect(
      gridSchema.safeParse({
        tag: "grid",
        items: [
          {
            text: "inNENU",
            icon: "https://example.com/icon.png",
            path: "pages/index/index",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("location schema 可通过 safeParse 校验", () => {
    expect(locationSchema.safeParse({ tag: "location", header: "" }).success).toBe(false);
    expect(
      locationSchema.safeParse({
        tag: "location",
        header: "东北师范大学",
        points: [{ loc: "43.123456,125.123456" }],
      }).success,
    ).toBe(true);
  });

  it("phone schema 可通过 safeParse 校验", () => {
    expect(phoneSchema.safeParse({ tag: "phone", num: "123", fName: "三" }).success).toBe(false);
    expect(phoneSchema.safeParse({ tag: "phone", num: "13800138000", fName: "三" }).success).toBe(
      true,
    );
  });

  it("video schema 可通过 safeParse 校验", () => {
    expect(videoSchema.safeParse({ tag: "video" }).success).toBe(false);
    expect(
      videoSchema.safeParse({ tag: "video", src: "https://example.com/demo.mp4" }).success,
    ).toBe(true);
  });
});
