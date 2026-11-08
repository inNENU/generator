import { describe, expect, it, vi } from "vitest";

import { getLocationMarkdown } from "../src/components/location/markdown.js";
import type { LocationComponentOptions } from "../src/components/location/schema.js";

const point = (name: string): { loc: string; name: string } => ({ loc: "43.8,125.3", name });

describe(getLocationMarkdown, () => {
  it("warns and keeps only the first four points", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(void 0);

    try {
      const output = getLocationMarkdown(
        {
          tag: "location",
          points: [point("A"), point("B"), point("C"), point("D"), point("E")],
        } as unknown as LocationComponentOptions,
        "guide/map",
      );

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("已忽略 1 个"));
      expect(output.match(/coord:/gu)).toHaveLength(4);
      expect(output).not.toContain("title:E");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not warn for four points", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(void 0);

    try {
      getLocationMarkdown(
        {
          tag: "location",
          points: [point("A"), point("B"), point("C"), point("D")],
        } as unknown as LocationComponentOptions,
        "guide/map",
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
