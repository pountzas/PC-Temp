import { describe, expect, it } from "vitest";
import { FIXTURES } from "../ipc/mock/fixtures";
import { isGpuHot } from "./hot";

describe("isGpuHot", () => {
  it("is true when alerts include gpu hot", () => {
    expect(isGpuHot(FIXTURES.hot)).toBe(true);
  });

  it("is false for compact fixture without gpu hot alert", () => {
    expect(isGpuHot(FIXTURES.compact)).toBe(false);
  });

  it("is false when tick is null", () => {
    expect(isGpuHot(null)).toBe(false);
  });

  it("is false for gpu warm only", () => {
    expect(isGpuHot(FIXTURES.warn)).toBe(false);
  });
});
