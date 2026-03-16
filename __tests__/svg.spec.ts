import { describe, expect, it } from "vitest";

import { convertSVGToBase64DataURI, convertSVGToDataURI } from "../src/helpers/svg.js";

describe(convertSVGToDataURI, () => {
  it("should convert simple SVG to data URI", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const result = convertSVGToDataURI(svg);

    expect(result).toBe(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E",
    );
  });

  it("should escape double quotes", () => {
    const svg = '<svg attr="value"></svg>';
    const result = convertSVGToDataURI(svg);

    expect(result).toContain("attr='value'");
    expect(result).not.toContain('"');
  });

  it("should escape angle brackets", () => {
    const svg = "<svg></svg>";
    const result = convertSVGToDataURI(svg);

    expect(result).toContain("%3C");
    expect(result).toContain("%3E");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("should escape hash symbols", () => {
    const svg = '<svg fill="#000"></svg>';
    const result = convertSVGToDataURI(svg);

    expect(result).toContain("%23000");
    expect(result).not.toContain("#");
  });

  it("should start with correct prefix", () => {
    const result = convertSVGToDataURI("<svg></svg>");

    expect(result).toMatch(/^data:image\/svg\+xml,/);
  });
});

describe(convertSVGToBase64DataURI, () => {
  it("should convert SVG to base64 data URI", () => {
    const svg = "<svg></svg>";
    const result = convertSVGToBase64DataURI(svg);

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("should produce valid base64", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const result = convertSVGToBase64DataURI(svg);
    const base64Part = result.replace("data:image/svg+xml;base64,", "");

    // Base64 should only contain valid characters
    expect(base64Part).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Decode and verify
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");

    expect(decoded).toContain("<svg");
    expect(decoded).toContain("circle");
  });

  it("should handle SVG with special characters", () => {
    const svg = '<svg><text>Hello & "World"</text></svg>';
    const result = convertSVGToBase64DataURI(svg);

    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
