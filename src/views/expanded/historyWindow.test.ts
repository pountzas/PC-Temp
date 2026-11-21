import { describe, expect, it } from "vitest";
import {
  historyPointCount,
  intervalLiveLabel,
  sliceHistory,
} from "./historyWindow";

describe("historyWindow", () => {
  it("keeps 60 / 30 / 12 points for 1s / 2s / 5s intervals", () => {
    expect(historyPointCount(1000)).toBe(60);
    expect(historyPointCount(2000)).toBe(30);
    expect(historyPointCount(5000)).toBe(12);
  });

  it("slices trailing window only", () => {
    const series = Array.from({ length: 80 }, (_, i) => i);
    expect(sliceHistory(series, 1000)).toHaveLength(60);
    expect(sliceHistory(series, 1000)[0]).toBe(20);
    expect(sliceHistory(series, 1000).at(-1)).toBe(79);
  });

  it("left-pads with nulls when fewer samples than the window", () => {
    const sparse = [10, 20, 30];
    const padded = sliceHistory(sparse, 1000);
    expect(padded).toHaveLength(60);
    expect(padded.slice(0, 57).every((v) => v === null)).toBe(true);
    expect(padded.at(-1)).toBe(30);
  });

  it("labels footer update interval", () => {
    expect(intervalLiveLabel(1000)).toBe("1s");
    expect(intervalLiveLabel(2000)).toBe("2s");
    expect(intervalLiveLabel(5000)).toBe("5s");
  });
});
