import { describe, expect, it } from "vitest";
import { stripModelName } from "./stripModelName";

describe("stripModelName", () => {
  it("strips Intel Core prefix", () => {
    expect(stripModelName("Intel Core i7-3770K")).toBe("i7-3770K");
  });

  it("strips Intel(R) Core(TM) marketing prefixes", () => {
    expect(stripModelName("Intel(R) Core(TM) i7-12700K")).toBe("i7-12700K");
  });

  it("strips only AMD vendor token, keeping Ryzen model", () => {
    expect(stripModelName("AMD Ryzen 7 3700X")).toBe("Ryzen 7 3700X");
  });

  it("strips NVIDIA GeForce prefix", () => {
    expect(stripModelName("NVIDIA GeForce GTX 980 Ti")).toBe("GTX 980 Ti");
  });

  it("returns the original string when no prefix matches", () => {
    expect(stripModelName("Custom CPU")).toBe("Custom CPU");
  });
});
