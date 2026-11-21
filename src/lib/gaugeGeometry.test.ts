import { describe, expect, it } from "vitest";
import {
  ARC_END_DEG,
  ARC_SPAN_DEG,
  ARC_START_DEG,
  arcPath,
  gaugeRadius,
  gaugeValueEndDeg,
  polar,
  type GaugeSize,
} from "./gaugeGeometry";

describe("gaugeGeometry", () => {
  describe("gaugeRadius", () => {
    it("matches spec r = S/2 − sw/2 − 3 for Compact S=62 sw=5", () => {
      expect(gaugeRadius(62, 5)).toBeCloseTo(25.5);
    });

    it("matches spec for Expanded S=84 sw=6", () => {
      expect(gaugeRadius(84, 6)).toBeCloseTo(36);
    });
  });

  describe("arc angles", () => {
    it("uses 135° start and 405° track end", () => {
      expect(ARC_START_DEG).toBe(135);
      expect(ARC_SPAN_DEG).toBe(270);
      expect(ARC_END_DEG).toBe(405);
    });
  });

  describe("gaugeValueEndDeg", () => {
    const compact: GaugeSize = { size: 62, strokeWidth: 5, valueFontSize: 18 };

    it("maps 34% load to 226.8° on Compact", () => {
      expect(gaugeValueEndDeg(34, compact)).toBeCloseTo(226.8, 1);
    });

    it("maps 58% load to 291.6° on Compact", () => {
      expect(gaugeValueEndDeg(58, compact)).toBeCloseTo(291.6, 1);
    });

    const expanded: GaugeSize = { size: 84, strokeWidth: 6, valueFontSize: 22 };

    it("maps 34% and 58% sweeps on Expanded", () => {
      expect(gaugeValueEndDeg(34, expanded)).toBeCloseTo(226.8, 1);
      expect(gaugeValueEndDeg(58, expanded)).toBeCloseTo(291.6, 1);
    });
  });

  describe("polar and arcPath (gen.py parity)", () => {
    it("places 0° on the positive x axis", () => {
      const [x, y] = polar(50, 50, 10, 0);
      expect(x).toBeCloseTo(60);
      expect(y).toBeCloseTo(50);
    });

    it("emits an SVG arc with large-arc when sweep exceeds 180°", () => {
      const d = arcPath(31, 31, 25.5, 135, 405);
      expect(d).toMatch(/^M [\d.]+ [\d.]+ A 25\.5 25\.5 0 1 1 /);
    });
  });
});
