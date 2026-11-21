// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { FIXTURES, type FixtureName } from "../../ipc/mock/fixtures";
import { startMockSensorEmitter } from "../../ipc/mock/emitter";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { SensorTick, Settings } from "../../ipc/types";

const fixtureNames = Object.keys(FIXTURES) as FixtureName[];

const mockSettingsState = vi.hoisted(() => ({
  settings: null as Settings | null,
}));

vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => mockSettingsState.settings ?? defaultSettings(),
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

function assertFixtureData(name: FixtureName) {
  const fixture = FIXTURES[name];
  switch (name) {
    case "compact":
      expect(screen.getByTestId("cpu-temp").textContent).toContain("52");
      break;
    case "expanded":
      expect(screen.getByTestId("cpu-temp").textContent).toContain("52");
      break;
    case "warn":
      expect(screen.getByTestId("gpu-temp").textContent).toContain("86");
      break;
    case "hot":
      expect(screen.getByTestId("gpu-hot-chip")).toBeTruthy();
      expect(screen.getByTestId("gpu-temp").textContent).toContain("91");
      break;
    case "no-nvml":
      expect(screen.getByTestId("gpu-temp").textContent).toContain("—");
      expect(screen.getByTestId("cpu-temp").textContent).toContain("52");
      break;
    case "no-pawnio":
      expect(screen.getByTestId("cpu-temp").textContent).toContain("—");
      expect(fixture.cpu.loadPct).toBe(41);
      break;
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

async function renderAppWithFixture(name: FixtureName) {
  vi.stubEnv("VITE_MOCK_FIXTURE", name);
  const view = render(<App />);
  await waitFor(() => assertFixtureData(name));
  return view;
}

describe("App integration (mock emitter + fixtures)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    mockSettingsState.settings = null;
  });

  beforeEach(() => {
    vi.stubEnv("VITE_MOCK_SENSORS", "1");
    mockSettingsState.settings = defaultSettings();
  });

  for (const name of fixtureNames) {
    it(`renders ${name} fixture through App`, async () => {
      const { container } = await renderAppWithFixture(name);
      expect(container.querySelector('[data-view="compact"]')).toBeTruthy();
      expect(screen.getByTestId("compact-column-cpu")).toBeTruthy();
    });
  }

  it("switches between compact, expanded, and pill views", async () => {
    mockSettingsState.settings = { ...defaultSettings(), view: "compact" };
    const { container, rerender } = await renderAppWithFixture("compact");
    expect(container.querySelector('[data-view="compact"]')).toBeTruthy();

    mockSettingsState.settings = { ...defaultSettings(), view: "expanded" };
    rerender(<App />);
    expect(container.querySelector('[data-view="expanded"]')).toBeTruthy();

    mockSettingsState.settings = { ...defaultSettings(), view: "pill" };
    rerender(<App />);
    expect(container.querySelector('[data-view="pill"]')).toBeTruthy();
  });

  it("shows GPU hot state from hot fixture", async () => {
    const { container } = await renderAppWithFixture("hot");
    expect(screen.getByTestId("gpu-hot-chip")).toBeTruthy();
    expect(container.querySelector(".compact-panel.is-hot")).toBeTruthy();
  });

  it("renders em dash placeholders for no-pawnio fixture", async () => {
    await renderAppWithFixture("no-pawnio");
    expect(screen.getByTestId("compact-footer-left").textContent).toContain(
      "—",
    );
  });

  it("formats temperatures in Fahrenheit when units are F", async () => {
    mockSettingsState.settings = { ...defaultSettings(), units: "F" };
    vi.stubEnv("VITE_MOCK_FIXTURE", "compact");
    render(<App />);
    await waitFor(() => {
      const cpuTemp = screen.getByTestId("cpu-temp");
      expect(cpuTemp.textContent).toMatch(/°F/);
      expect(cpuTemp.textContent).toContain("126");
    });
  });

  it("startMockSensorEmitter delivers a pinned warn fixture", () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_MOCK_FIXTURE", "warn");
    const received: SensorTick[] = [];
    const stop = startMockSensorEmitter((tick) => {
      received.push(tick);
    }, 1000);

    expect(received.length).toBe(1);
    vi.advanceTimersByTime(1000);
    stop();

    expect(received.length).toBe(2);
    expect(received[0]?.cpu.packageTempC).toBe(FIXTURES.warn.cpu.packageTempC);
    expect(received[1]?.cpu.packageTempC).toBe(FIXTURES.warn.cpu.packageTempC);
  });
});