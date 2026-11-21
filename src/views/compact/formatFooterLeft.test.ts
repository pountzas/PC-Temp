import { describe, expect, it } from "vitest";
import { formatFooterLeft } from "./formatFooterLeft";

describe("formatFooterLeft", () => {
  it("formats interval and clocks from compact fixture sample", () => {
    expect(formatFooterLeft(1000, 3900, 1150)).toBe(
      "UPDATE 1s · 3.90 / 1.15 GHz",
    );
  });

  it("uses em dashes for null clocks", () => {
    expect(formatFooterLeft(2000, null, 1150)).toBe("UPDATE 2s · — / 1.15 GHz");
  });
});
