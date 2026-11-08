import { describe, expect, it } from "vitest";

import { getDocMarkdown } from "../src/components/doc/markdown.js";
import type { DocComponentOptions } from "../src/components/doc/schema.js";

const base = {
  tag: "doc",
  name: "新生手册",
  url: "https://example.com/manual.zip",
} as const;

describe(getDocMarkdown, () => {
  it("renders a download link by default", () => {
    const output = getDocMarkdown(base);

    expect(output).toContain('download="新生手册"');
    expect(output).not.toContain('target="_blank"');
  });

  it("renders a view link when downloadable is false", () => {
    const output = getDocMarkdown({
      ...base,
      downloadable: false,
    } as unknown as DocComponentOptions);

    expect(output).not.toContain("download=");
    expect(output).toContain('target="_blank"');
    expect(output).toContain("新生手册");
  });

  it("keeps previewable documents as view links", () => {
    const output = getDocMarkdown({
      ...base,
      url: "https://example.com/manual.pdf",
      downloadable: false,
    } as unknown as DocComponentOptions);

    expect(output).not.toContain("download=");
    expect(output).toContain('target="_blank"');
  });
});
