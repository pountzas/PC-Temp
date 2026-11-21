import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatGhz,
  formatNull,
  formatPct,
  formatTemp,
} from "./format";

describe("format", () => {
  it("renders null as em dash, never zero", () => {
    expect(formatNull(null)).toBe("—");
    expect(formatPct(null)).toBe("—");
    expect(formatTemp(null, "C")).toBe("—");
    expect(formatTemp(null, "F")).toBe("—");
  });

  describe("formatTemp", () => {
    it("keeps °C as integer", () => {
      expect(formatTemp(52, "C")).toBe("52");
    });

    it("converts °C to rounded °F", () => {
      expect(formatTemp(0, "F")).toBe("32");
      expect(formatTemp(100, "F")).toBe("212");
      expect(formatTemp(52, "F")).toBe("126");
    });
  });

  describe("formatGhz", () => {
    it("formats MHz with two decimals in GHz", () => {
      expect(formatGhz(3900)).toBe("3.90");
      expect(formatGhz(1150)).toBe("1.15");
    });

    it("returns em dash for null MHz", () => {
      expect(formatGhz(null)).toBe("—");
    });
  });

  describe("formatClock", () => {
    it("formats tick timestamp as local 24h HH:mm:ss", () => {
      const ts = new Date(2026, 10, 19, 14, 32, 7).getTime();
      expect(formatClock(ts)).toBe("14:32:07");
    });
  });
});
