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

  it("trusts alerts over gpu temperature", () => {
    const highTempNoAlert = {
      ...FIXTURES.compact,
      gpu: { ...FIXTURES.compact.gpu, coreTempC: 91 },
      alerts: [],
    };
    expect(isGpuHot(highTempNoAlert)).toBe(false);

    const lowTempWithHotAlert = {
      ...FIXTURES.compact,
      gpu: { ...FIXTURES.compact.gpu, coreTempC: 64 },
      alerts: [{ component: "gpu" as const, level: "hot" as const, tempC: 64 }],
    };
    expect(isGpuHot(lowTempWithHotAlert)).toBe(true);
  });
});
