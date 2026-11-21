import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "./mock/fixtures";
import type { SensorTick } from "./types";
import { parseSensorTick, serializeSensorTick } from "./types";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));
}

const TOP_LEVEL_KEYS = ["alerts", "cpu", "gpu", "history", "intervalMs", "ts"];
const CPU_KEYS = [
  "baseClockMHz",
  "clockMHz",
  "cores",
  "loadPct",
  "name",
  "packagePowerW",
  "packageTempC",
  "threads",
];
const CORE_KEYS = ["clockMHz", "index", "loadPct", "tempC"];
const GPU_KEYS = [
  "coreClockMHz",
  "coreTempC",
  "fanPct",
  "loadPct",
  "name",
  "vramTotalMiB",
  "vramUsedMiB",
];

describe("SensorTick IPC contract", () => {
  it.each(Object.entries(FIXTURES))(
    "%s matches the SensorTick key set exactly",
    (_name, tick) => {
      expect(Object.keys(tick).sort()).toEqual(TOP_LEVEL_KEYS);
      expect(Object.keys(tick.cpu).sort()).toEqual(CPU_KEYS);
      for (const core of tick.cpu.cores) {
        expect(Object.keys(core).sort()).toEqual(CORE_KEYS);
      }
      expect(Object.keys(tick.gpu).sort()).toEqual(GPU_KEYS);
      expect(Object.keys(tick.history).sort()).toEqual(["cpuLoad", "gpuLoad"]);
      expect(tick.history.cpuLoad).toHaveLength(60);
      expect(tick.history.gpuLoad).toHaveLength(60);
      for (const thread of tick.cpu.threads ?? []) {
        expect(Object.keys(thread).sort()).toEqual(["index", "loadPct"]);
      }
      for (const alert of tick.alerts) {
        expect(Object.keys(alert).sort()).toEqual([
          "component",
          "level",
          "tempC",
        ]);
      }
    },
  );

  it("preserves null optional readings (no null becomes 0)", () => {
    const raw = loadFixture("no-pawnio.json") as SensorTick;
    expect(raw.cpu.packageTempC).toBeNull();
    expect(raw.cpu.packagePowerW).toBeNull();
    expect(raw.cpu.clockMHz).toBeNull();
    const roundTrip = parseSensorTick(JSON.parse(serializeSensorTick(raw)));
    expect(roundTrip.cpu.packageTempC).toBeNull();
    expect(roundTrip.cpu.packagePowerW).toBeNull();
    expect(roundTrip.cpu.clockMHz).toBeNull();
  });

  it("has no GPU power field on compact fixture", () => {
    const raw = loadFixture("compact.json") as Record<string, unknown>;
    const gpu = raw.gpu as Record<string, unknown>;
    expect(gpu).not.toHaveProperty("powerW");
    expect(gpu).not.toHaveProperty("packagePowerW");
  });
});
