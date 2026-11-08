import { describe, expect, it } from "vitest";

import { getDocDisplayName, getDocIcon, isPreviewableDoc } from "../src/components/doc/utils.js";

describe("doc 工具", () => {
  it("按 URL 路径取扩展名，忽略查询串与 hash", () => {
    expect(getDocIcon("https://example.com/files/通知.pdf?download=1&x=#top")).toBe("pdf");
    expect(getDocIcon("https://example.com/files/表格.XLSX")).toBe("xls");
    expect(getDocIcon("https://example.com/files/图片.jfif")).toBe("jpg");
    expect(getDocIcon("https://example.com/download")).toBe("document");
    expect(isPreviewableDoc("https://example.com/files/通知.pdf?download=1")).toBe(true);
    expect(isPreviewableDoc("https://example.com/files/通知.docx")).toBe(false);
  });

  it("显示名不重复追加扩展名，无扩展名时原样返回", () => {
    expect(getDocDisplayName("通知", "https://example.com/files/通知.pdf?download=1")).toBe(
      "通知.pdf",
    );
    expect(getDocDisplayName("通知.PDF", "https://example.com/files/通知.pdf")).toBe("通知.PDF");
    expect(getDocDisplayName("下载文件", "https://example.com/download")).toBe("下载文件");
    expect(getDocDisplayName("附件", "")).toBe("附件");
  });
});
