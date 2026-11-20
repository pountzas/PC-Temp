import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SensorTick } from "./types";
import { parseSensorTick, serializeSensorTick } from "./types";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));
}

describe("SensorTick IPC contract", () => {
  it("round-trips compact.json without field drift", () => {
    const raw = loadFixture("compact.json");
    const tick = parseSensorTick(raw);
    const again = parseSensorTick(JSON.parse(serializeSensorTick(tick)));
    expect(again).toEqual(tick);
  });

  it("preserves null optional readings (no null becomes 0)", () => {
    const raw = loadFixture("no-pawnio.json") as SensorTick;
    expect(raw.cpu.packageTempC).toBeNull();
    expect(raw.cpu.packagePowerW).toBeNull();
    expect(raw.cpu.clockMHz).toBeNull();
    const roundTrip = parseSensorTick(
      JSON.parse(serializeSensorTick(raw)),
    ) as SensorTick;
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