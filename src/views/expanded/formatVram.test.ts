import { describe, expect, it } from "vitest";
import { formatVramGiB, vramFillRatio } from "./formatVram";

describe("formatVram", () => {
  it("formats expanded fixture as 3.4 / 6.0 GB", () => {
    expect(formatVramGiB(3482, 6144)).toBe("3.4 / 6.0 GB");
  });

  it("renders em dash when either side is null", () => {
    expect(formatVramGiB(null, 6144)).toBe("—");
    expect(formatVramGiB(512, null)).toBe("—");
  });

  it("returns null fill ratio without zero placeholders", () => {
    expect(vramFillRatio(null, 6144)).toBeNull();
    expect(vramFillRatio(3482, null)).toBeNull();
  });
});
