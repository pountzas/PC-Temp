import { describe, expect, it } from "vitest";
import type { SensorTick } from "../ipc/types";
import { barFillToken, levelForTempC, textColorToken } from "./tempColor";

const emptyTick: SensorTick = {
  ts: 0,
  intervalMs: 1000,
  cpu: {
    name: "",
    loadPct: null,
    packageTempC: null,
    packagePowerW: null,
    clockMHz: null,
    baseClockMHz: 3500,
    cores: [],
  },
  gpu: {
    name: "",
    loadPct: null,
    coreTempC: null,
    coreClockMHz: null,
    fanPct: null,
    vramUsedMiB: null,
    vramTotalMiB: null,
  },
  history: { cpuLoad: [], gpuLoad: [] },
  alerts: [],
};

describe("tempColor", () => {
  describe("fallback levels without tick (°C compare)", () => {
    it("marks 84 °C as normal", () => {
      expect(levelForTempC(84, null, "cpu")).toBe("normal");
      expect(textColorToken("normal")).toBe("var(--color-text)");
    });

    it("marks 85 °C as warn and 89 °C as still warn", () => {
      expect(levelForTempC(85, null, "cpu")).toBe("warn");
      expect(levelForTempC(89, null, "cpu")).toBe("warn");
      expect(textColorToken("warn")).toBe("var(--color-warm)");
    });

    it("marks 90 °C as hot", () => {
      expect(levelForTempC(90, null, "cpu")).toBe("hot");
      expect(textColorToken("hot")).toBe("var(--color-hot)");
    });
  });

  describe("bar fill colours", () => {
    it("uses accent for normal, warm token for warn, hot token for hot", () => {
      expect(barFillToken("normal")).toBe("var(--color-accent)");
      expect(barFillToken("warn")).toBe("var(--color-warm)");
      expect(barFillToken("hot")).toBe("var(--color-hot)");
    });
  });

  describe("tick alerts override", () => {
    it("reads warm/hot from tick.alerts when present", () => {
      const tick: SensorTick = {
        ...emptyTick,
        alerts: [{ component: "gpu", level: "hot", tempC: 92 }],
      };
      expect(levelForTempC(70, tick, "gpu")).toBe("hot");
    });

    it("trusts tick.alerts over raw temp when a tick exists", () => {
      expect(levelForTempC(95, emptyTick, "cpu")).toBe("normal");
      const gpuOnly: SensorTick = {
        ...emptyTick,
        alerts: [{ component: "gpu", level: "hot", tempC: 92 }],
      };
      expect(levelForTempC(95, gpuOnly, "cpu")).toBe("normal");
      const warm: SensorTick = {
        ...emptyTick,
        alerts: [{ component: "cpu", level: "warm", tempC: 86 }],
      };
      expect(levelForTempC(83, warm, "cpu")).toBe("warn");
    });
  });
});
