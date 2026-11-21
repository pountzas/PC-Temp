// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURES } from "./fixtures";
import { startMockSensorEmitter } from "./emitter";

describe("startMockSensorEmitter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MOCK_FIXTURE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("repeats a pinned fixture when VITE_MOCK_FIXTURE is set", () => {
    vi.stubEnv("VITE_MOCK_FIXTURE", "hot");
    const ticks: string[] = [];

    const stop = startMockSensorEmitter((tick) => {
      ticks.push(tick.cpu.name);
    }, 1000);

    vi.advanceTimersByTime(2500);
    stop();

    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.every((name) => name === FIXTURES.hot.cpu.name)).toBe(true);
  });

  it("cycles fixtures when VITE_MOCK_FIXTURE is unset or cycle", () => {
    vi.stubEnv("VITE_MOCK_FIXTURE", "cycle");
    const temps = new Set<number | null>();

    const stop = startMockSensorEmitter((tick) => {
      temps.add(tick.cpu.packageTempC);
    }, 1000);

    vi.advanceTimersByTime(6000);
    stop();

    expect(temps.size).toBeGreaterThan(1);
  });

  it("cycles when VITE_MOCK_FIXTURE is an inherited key name such as toString", () => {
    vi.stubEnv("VITE_MOCK_FIXTURE", "toString");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const temps = new Set<number | null>();

    const stop = startMockSensorEmitter((tick) => {
      temps.add(tick.cpu.packageTempC);
    }, 1000);

    vi.advanceTimersByTime(6000);
    stop();

    expect(warn).toHaveBeenCalled();
    expect(temps.size).toBeGreaterThan(1);
    warn.mockRestore();
  });

  it("honours the intervalMs argument", () => {
    vi.stubEnv("VITE_MOCK_FIXTURE", "compact");
    let count = 0;

    const stop = startMockSensorEmitter(() => {
      count += 1;
    }, 2000);

    expect(count).toBe(1);
    vi.advanceTimersByTime(1999);
    expect(count).toBe(1);
    vi.advanceTimersByTime(1);
    expect(count).toBe(2);
    stop();
  });
});
