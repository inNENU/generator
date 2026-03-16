import { describe, expect, it } from "vitest";

import { getDocIcon } from "../src/components/doc/utils.js";

describe(getDocIcon, () => {
  it("should return empty string for empty url", () => {
    expect(getDocIcon("")).toBe("");
  });

  it("should return doc for .doc and .docx", () => {
    expect(getDocIcon("file.doc")).toBe("doc");
    expect(getDocIcon("file.docx")).toBe("doc");
  });

  it("should return ppt for .ppt and .pptx", () => {
    expect(getDocIcon("file.ppt")).toBe("ppt");
    expect(getDocIcon("file.pptx")).toBe("ppt");
  });

  it("should return xls for .xls and .xlsx", () => {
    expect(getDocIcon("file.xls")).toBe("xls");
    expect(getDocIcon("file.xlsx")).toBe("xls");
  });

  it("should return pdf for .pdf", () => {
    expect(getDocIcon("file.pdf")).toBe("pdf");
  });

  it("should return jpg for image formats", () => {
    expect(getDocIcon("file.jpg")).toBe("jpg");
    expect(getDocIcon("file.jpeg")).toBe("jpg");
    expect(getDocIcon("file.jfif")).toBe("jpg");
  });

  it("should return video for video formats", () => {
    expect(getDocIcon("file.mp4")).toBe("video");
    expect(getDocIcon("file.mov")).toBe("video");
    expect(getDocIcon("file.avi")).toBe("video");
    expect(getDocIcon("file.rmvb")).toBe("video");
  });

  it("should return png for .png", () => {
    expect(getDocIcon("file.png")).toBe("png");
  });

  it("should return gif for .gif", () => {
    expect(getDocIcon("file.gif")).toBe("gif");
  });

  it("should return document for unknown extensions", () => {
    expect(getDocIcon("file.txt")).toBe("document");
    expect(getDocIcon("file.zip")).toBe("document");
  });
});
