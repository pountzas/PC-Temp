import { describe, expect, it } from "vitest";
import { HOT_C, HYSTERESIS_C, WARM_C } from "./thresholds";

describe("temperature thresholds", () => {
  it("matches spec OQ-5", () => {
    expect(WARM_C).toBe(85);
    expect(HOT_C).toBe(90);
    expect(HYSTERESIS_C).toBe(3);
  });
});
