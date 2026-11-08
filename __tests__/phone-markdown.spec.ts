import { describe, expect, it } from "vitest";

import { getPhoneMarkdown } from "../src/components/phone/markdown.js";

describe(getPhoneMarkdown, () => {
  it("keeps multi-line remarks inside the list item", () => {
    const markdown = getPhoneMarkdown({
      tag: "phone",
      num: 10086,
      fName: "三",
      lName: "张",
      remark: "第一行\n第二行",
    });

    expect(markdown).toContain("- 备注: 第一行\n  第二行");
  });
});
