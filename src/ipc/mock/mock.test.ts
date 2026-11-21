import { describe, expect, it } from "vitest";
import { FIXTURES } from "./fixtures";

describe("sensor fixtures", () => {
  it("includes all named mock scenarios", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([
      "compact",
      "expanded",
      "hot",
      "no-nvml",
      "no-pawnio",
      "warn",
    ]);
  });

  it("never ships a GPU power field", () => {
    for (const fixture of Object.values(FIXTURES)) {
      expect(fixture.gpu).not.toHaveProperty("powerW");
    }
  });
});
