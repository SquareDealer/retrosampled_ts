import { describe, it, expect } from "vitest";
import { formatCompactNumber } from "./formatCompactNumber";

describe("formatCompactNumber", () => {
  it("returns 0 for non-positive or invalid values", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(-5)).toBe("0");
    expect(formatCompactNumber(Number.NaN)).toBe("0");
  });

  it("formats values below a thousand verbatim", () => {
    expect(formatCompactNumber(1)).toBe("1");
    expect(formatCompactNumber(999)).toBe("999");
  });

  it("formats thousands with a K suffix", () => {
    expect(formatCompactNumber(1000)).toBe("1K");
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(74000)).toBe("74K");
    expect(formatCompactNumber(284000)).toBe("284K");
  });

  it("formats millions and billions", () => {
    expect(formatCompactNumber(1_000_000)).toBe("1M");
    expect(formatCompactNumber(2_500_000)).toBe("2.5M");
    expect(formatCompactNumber(1_000_000_000)).toBe("1B");
  });
});
