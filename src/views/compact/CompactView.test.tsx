// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURES } from "../../ipc/mock/fixtures";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { SensorTick, Settings } from "../../ipc/types";
import { formatClock } from "../../lib/format";
import { CompactView } from "./CompactView";

const headerActions = vi.hoisted(() => ({
  expandView: vi.fn(),
  hideWidget: vi.fn(),
  openSettingsPanel: vi.fn(),
  toggleAlwaysOnTop: vi.fn(),
}));

vi.mock("./compactHeaderActions", () => headerActions);

function renderCompact(
  tick: SensorTick | null = FIXTURES.compact,
  settingsPatch: Partial<Settings> = {},
) {
  const settings: Settings = { ...defaultSettings(), ...settingsPatch };
  return render(<CompactView tick={tick} settings={settings} />);
}

describe("CompactView", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders compact layout with fixture data", () => {
    renderCompact();
    expect(screen.getByTestId("compact-column-cpu")).toBeTruthy();
    expect(screen.getByTestId("compact-column-gpu")).toBeTruthy();
    expect(screen.getByTestId("compact-footer-left").textContent).toBe(
      "UPDATE 1s · 3.90 / 1.15 GHz",
    );
  });

  it("wires header buttons to commands", () => {
    renderCompact();
    const labels = ["Settings", "Expand view", "Always on top", "Hide widget"];
    for (const label of labels) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    expect(headerActions.openSettingsPanel).toHaveBeenCalled();
    expect(headerActions.expandView).toHaveBeenCalled();
    expect(headerActions.toggleAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(headerActions.hideWidget).toHaveBeenCalled();
  });

  it("updates footer clock when tick ts changes", () => {
    const base = FIXTURES.compact;
    const { rerender } = renderCompact(base);
    expect(screen.getByTestId("compact-footer-clock").textContent).toBe(
      formatClock(base.ts),
    );
    const newer: SensorTick = { ...base, ts: base.ts + 5_000 };
    rerender(<CompactView tick={newer} settings={defaultSettings()} />);
    expect(screen.getByTestId("compact-footer-clock").textContent).toBe(
      formatClock(newer.ts),
    );
  });

  it("uses footer placeholders when tick is null", () => {
    renderCompact(null);
    expect(screen.getByTestId("compact-footer-left").textContent).toBe(
      "UPDATE 1s · — / — GHz",
    );
    expect(screen.getByTestId("compact-footer-clock").textContent).toBe("—");
  });

  it("shows Fahrenheit unit suffix when settings use F", () => {
    renderCompact(FIXTURES.compact, { units: "F" });
    const cpuTemp = screen.getByTestId("cpu-temp");
    expect(cpuTemp.textContent).toContain("126");
    expect(cpuTemp.textContent).toContain("°F");
  });

  it("reflects pin active state from settings", () => {
    const { rerender } = renderCompact(FIXTURES.compact, {
      alwaysOnTop: false,
    });
    const pinOff = screen.getByRole("button", { name: "Always on top" });
    expect(pinOff.style.background).not.toBe("var(--color-accent-bg)");

    rerender(
      <CompactView
        tick={FIXTURES.compact}
        settings={{ ...defaultSettings(), alwaysOnTop: true }}
      />,
    );
    const pinOn = screen.getByRole("button", { name: "Always on top" });
    expect(pinOn.style.background).toBe("var(--color-accent-bg)");
  });

  it("uses tick intervalMs in footer when it differs from settings", () => {
    const tick: SensorTick = { ...FIXTURES.compact, intervalMs: 5000 };
    renderCompact(tick, { intervalMs: 1000 });
    expect(screen.getByTestId("compact-footer-left").textContent).toBe(
      "UPDATE 5s · 3.90 / 1.15 GHz",
    );
  });
});
