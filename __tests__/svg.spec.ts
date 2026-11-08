import { describe, expect, it } from "vitest";

import { convertSVGToBase64DataURI, convertSVGToDataURI } from "../src/helpers/svg.js";

describe(convertSVGToDataURI, () => {
  it("should keep the SVG readable through percent-encoding", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const result = convertSVGToDataURI(svg);

    expect(result).toMatch(/^data:image\/svg\+xml,/u);
    expect(decodeURIComponent(result.slice("data:image/svg+xml,".length))).toBe(svg);
  });

  it("should percent-encode XML special characters and URI delimiters", () => {
    const result = convertSVGToDataURI('<svg fill="#000" data-x="a&b">100%</svg>');

    expect(result).toMatch(/^data:image\/svg\+xml,/u);

    for (const encoded of ["%3C", "%3E", "%23", "%25", "%22", "%26"])
      expect(result).toContain(encoded);

    expect(result).not.toMatch(/[<>#"]/u);
  });

  it("should round-trip non-ASCII text", () => {
    const svg = "<svg><text>café 东北师范大学</text></svg>";

    expect(decodeURIComponent(convertSVGToDataURI(svg).slice("data:image/svg+xml,".length))).toBe(
      svg,
    );
  });
});

describe(convertSVGToBase64DataURI, () => {
  it("should convert SVG to base64 data URI", () => {
    const svg = "<svg></svg>";
    const result = convertSVGToBase64DataURI(svg);

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/u);
  });

  it("should produce valid base64", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const result = convertSVGToBase64DataURI(svg);
    const base64Part = result.replace("data:image/svg+xml;base64,", "");

    // Base64 should only contain valid characters
    expect(base64Part).toMatch(/^[A-Za-z0-9+/]+=*$/u);

    // Decode and verify
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");

    expect(decoded).toContain("<svg");
    expect(decoded).toContain("circle");
  });

  it("should handle SVG with special characters", () => {
    const svg = '<svg><text>Hello & "World"</text></svg>';
    const result = convertSVGToBase64DataURI(svg);

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/u);
  });

  it("should round-trip non-ASCII latin text unchanged", () => {
    const svg = "<svg><text>café</text></svg>";
    const result = convertSVGToBase64DataURI(svg);
    const decoded = Buffer.from(
      result.replace("data:image/svg+xml;base64,", ""),
      "base64",
    ).toString("utf-8");

    expect(decoded).toBe(svg);
    expect(decoded).toContain("café");
    expect(decoded).not.toContain("cafÃ©");
  });

  it("should round-trip Chinese text unchanged", () => {
    const svg = "<svg><text>东北师范大学</text></svg>";
    const result = convertSVGToBase64DataURI(svg);
    const decoded = Buffer.from(
      result.replace("data:image/svg+xml;base64,", ""),
      "base64",
    ).toString("utf-8");

    expect(decoded).toBe(svg);
    expect(decoded).toContain("东北师范大学");
  });
});
