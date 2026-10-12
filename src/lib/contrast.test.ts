import { describe, expect, it } from "vitest";
import { contrastRatio, grayHex, hexToRgb, judgeContrast, relativeLuminance, WCAG_AA } from "./contrast";

describe("contrastRatio", () => {
  it("matches the WCAG reference values for black and white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#767676", "#121212")).toBeCloseTo(contrastRatio("#121212", "#767676")!, 10);
  });

  it("reproduces the well-known #767676 on white (the lightest gray that passes AA) and #777777 (which fails)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("accepts hex with or without the leading #, in any case", () => {
    expect(contrastRatio("FFFFFF", "000000")).toBeCloseTo(21, 5);
  });

  it("returns null for invalid input instead of guessing", () => {
    expect(contrastRatio("not-a-color", "#ffffff")).toBeNull();
    expect(contrastRatio("#fff", "#000")).toBeNull(); // short hex is not supported
    expect(relativeLuminance("")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });
});

describe("grayHex", () => {
  it("builds a neutral gray and clamps out-of-range levels", () => {
    expect(grayHex(118)).toBe("#767676");
    expect(grayHex(0)).toBe("#000000");
    expect(grayHex(999)).toBe("#ffffff");
    expect(grayHex(-5)).toBe("#000000");
  });
});

describe("judgeContrast", () => {
  it("applies the AA thresholds for normal and large text", () => {
    expect(WCAG_AA).toEqual({ normalText: 4.5, largeText: 3 });
    // Mid gray on near-black: fails for normal text, passes for large text.
    const mid = judgeContrast("#767676", "#121212")!;
    expect(mid.ratio).toBeGreaterThan(4);
    expect(mid.ratio).toBeLessThan(4.5);
    expect(mid).toMatchObject({ normalText: false, largeText: true });
    // Lighter gray on the same background passes both.
    expect(judgeContrast("#a0a0a0", "#121212")).toMatchObject({ normalText: true, largeText: true });
    // Very dark gray on near-black fails both.
    expect(judgeContrast("#3a3a3a", "#121212")).toMatchObject({ normalText: false, largeText: false });
  });

  it("is null for invalid colors", () => {
    expect(judgeContrast("x", "#fff")).toBeNull();
  });
});
