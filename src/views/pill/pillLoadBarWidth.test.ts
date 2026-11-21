import { describe, expect, it } from "vitest";
import { pillLoadBarFillPx } from "./pillLoadBarWidth";

describe("pillLoadBarFillPx", () => {
  it("matches gen.py bar width (30 × load/100)", () => {
    expect(pillLoadBarFillPx(34)).toBe(10);
    expect(pillLoadBarFillPx(58)).toBe(17);
  });

  it("null load yields zero width", () => {
    expect(pillLoadBarFillPx(null)).toBe(0);
  });
});
