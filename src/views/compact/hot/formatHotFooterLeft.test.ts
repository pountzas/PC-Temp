import { describe, expect, it } from "vitest";
import { formatHotFooterLeft } from "./formatHotFooterLeft";

describe("formatHotFooterLeft", () => {
  it("formats hot fixture footer without watts", () => {
    const left = formatHotFooterLeft(1020, 78);
    expect(left).toBe("TEMP LIMIT · 1.02 GHz · FAN 78%");
    expect(left).not.toMatch(/watt|W\b|245/i);
  });

  it("omits null clock and fan segments", () => {
    expect(formatHotFooterLeft(null, null)).toBe("TEMP LIMIT");
    expect(formatHotFooterLeft(1020, null)).toBe("TEMP LIMIT · 1.02 GHz");
    expect(formatHotFooterLeft(null, 78)).toBe("TEMP LIMIT · FAN 78%");
  });
});
