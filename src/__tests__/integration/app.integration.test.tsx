// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { FIXTURES, type FixtureName } from "../../ipc/mock/fixtures";
import { startMockSensorEmitter } from "../../ipc/mock/emitter";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { SensorTick, Settings } from "../../ipc/types";

const fixtureNames = Object.keys(FIXTURES) as FixtureName[];

const mockSettingsState = vi.hoisted(() => ({
  settings: null as Settings | null,
  tick: null as SensorTick | null,
}));

vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => mockSettingsState.settings ?? defaultSettings(),
}));

vi.mock("../../ipc/useSensors", () => ({
  useSensors: () => mockSettingsState.tick,
}));

vi.mock("../../window/focus", () => ({
  useFocusClass: () => {},
}));

vi.mock("../../window/dock", () => ({
  useDock: () => {},
}));

vi.mock("../../views/settings/useSettingsDim", () => ({
  useSettingsDim: () => {},
}));

describe("App integration (mock emitter + fixtures)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    mockSettingsState.settings = null;
    mockSettingsState.tick = null;
  });

  beforeEach(() => {
    vi.stubEnv("VITE_MOCK_SENSORS", "1");
    mockSettingsState.settings = defaultSettings();
  });

  for (const name of fixtureNames) {
    it(`renders ${name} fixture through App`, () => {
      mockSettingsState.tick = FIXTURES[name];
      const { container } = render(<App />);
      expect(container.querySelector('[data-view="compact"]')).toBeTruthy();
      expect(screen.getByTestId("compact-column-cpu")).toBeTruthy();
    });
  }

  it("switches between compact, expanded, and pill views", () => {
    mockSettingsState.tick = FIXTURES.compact;

    mockSettingsState.settings = { ...defaultSettings(), view: "compact" };
    const { container, rerender } = render(<App />);
    expect(container.querySelector('[data-view="compact"]')).toBeTruthy();

    mockSettingsState.settings = { ...defaultSettings(), view: "expanded" };
    rerender(<App />);
    expect(container.querySelector('[data-view="expanded"]')).toBeTruthy();

    mockSettingsState.settings = { ...defaultSettings(), view: "pill" };
    rerender(<App />);
    expect(container.querySelector('[data-view="pill"]')).toBeTruthy();
  });

  it("shows GPU hot state from hot fixture", () => {
    mockSettingsState.tick = FIXTURES.hot;
    const { container } = render(<App />);
    expect(screen.getByTestId("gpu-hot-chip")).toBeTruthy();
    expect(container.querySelector(".compact-panel.is-hot")).toBeTruthy();
  });

  it("renders em dash placeholders for no-pawnio fixture", () => {
    mockSettingsState.tick = FIXTURES["no-pawnio"];
    render(<App />);
    expect(screen.getByTestId("compact-footer-left").textContent).toContain(
      "—",
    );
  });

  it("formats temperatures in Fahrenheit when units are F", () => {
    mockSettingsState.tick = FIXTURES.compact;
    mockSettingsState.settings = { ...defaultSettings(), units: "F" };
    render(<App />);
    const cpuTemp = screen.getByTestId("cpu-temp");
    expect(cpuTemp.textContent).toMatch(/°F/);
    expect(cpuTemp.textContent).toContain("126");
  });

  it("startMockSensorEmitter delivers a pinned warn fixture", () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MOCK_FIXTURE", "warn");
    const received: SensorTick[] = [];
    const stop = startMockSensorEmitter((tick) => {
      received.push(tick);
    }, 1000);

    vi.advanceTimersByTime(1);
    stop();

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]?.cpu.packageTempC).toBe(FIXTURES.warn.cpu.packageTempC);
  });
});
