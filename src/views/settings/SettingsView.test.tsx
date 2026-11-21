// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { Settings } from "../../ipc/types";
import { SettingsView } from "./SettingsView";

const { updateSettings, closeSettings } = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  closeSettings: vi.fn(),
}));

vi.mock("../../ipc/commands", () => ({
  updateSettings,
  closeSettings,
}));

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    updateSettings.mockResolvedValue(defaultSettings());
  });

  it("renders settings rows from the sample state", () => {
    render(<SettingsView settings={defaultSettings()} />);

    expect(screen.getByText("SETTINGS")).toBeTruthy();
    expect(screen.getByLabelText("Opacity slider")).toBeTruthy();
    expect(screen.getByText("Click-through")).toBeTruthy();
    expect(
      screen.getByText("Clicks pass through · turn off from tray"),
    ).toBeTruthy();
    expect(screen.getByText("Always on top")).toBeTruthy();
    expect(screen.getByText("Units")).toBeTruthy();
    expect(screen.getByText("Update interval")).toBeTruthy();
    expect(screen.getByText("Start with Windows")).toBeTruthy();
    expect(screen.getByText("Theme accent")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close settings" })).toBeTruthy();
  });

  it("keeps the click-through sub-label when clickThrough is on", () => {
    const settings: Settings = { ...defaultSettings(), clickThrough: true };
    render(<SettingsView settings={settings} />);
    expect(
      screen.getByText("Clicks pass through · turn off from tray"),
    ).toBeTruthy();
  });

  it("reflects selected segment and accent swatch state", () => {
    render(<SettingsView settings={defaultSettings()} />);
    expect(
      screen.getByRole("button", { name: "°C", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "1s", pressed: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "#22E5FF", checked: true }),
    ).toBeTruthy();
  });

  it.each([
    {
      label: "Always on top",
      toggleName: "Always on top",
      expected: { alwaysOnTop: false },
    },
    {
      label: "Units",
      buttonName: "°F",
      expected: { units: "F" as const },
    },
    {
      label: "Update interval",
      buttonName: "2s",
      expected: { intervalMs: 2000 as const },
    },
    {
      label: "Click-through",
      toggleName: "Click-through",
      expected: { clickThrough: true },
    },
    {
      label: "Theme accent",
      radioName: "#B65CFF",
      expected: { accent: "#B65CFF" as const },
    },
  ])(
    "sends $expected via update_settings when changing $label",
    async (row) => {
      render(<SettingsView settings={defaultSettings()} />);

      if ("toggleName" in row && row.toggleName) {
        fireEvent.click(screen.getByRole("switch", { name: row.toggleName }));
      } else if ("buttonName" in row && row.buttonName) {
        fireEvent.click(screen.getByRole("button", { name: row.buttonName }));
      } else if ("radioName" in row && row.radioName) {
        fireEvent.click(screen.getByRole("radio", { name: row.radioName }));
      }

      await waitFor(() => {
        expect(updateSettings).toHaveBeenCalledWith(row.expected);
      });
    },
  );

  it("throttles opacity slider patches by 100ms", () => {
    vi.useFakeTimers();
    render(<SettingsView settings={defaultSettings()} />);

    const slider = screen.getByLabelText("Opacity slider");
    fireEvent.change(slider, { target: { value: "40" } });

    expect(updateSettings).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(updateSettings).toHaveBeenCalledWith({ opacityPct: 40 });
  });

  it("shows pending autostart while update_settings is in flight", async () => {
    let resolve!: (value: Settings) => void;
    updateSettings.mockImplementation(
      () =>
        new Promise<Settings>((res) => {
          resolve = res;
        }),
    );

    render(<SettingsView settings={defaultSettings()} />);
    const toggle = screen.getByRole("switch", { name: "Start with Windows" });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute("aria-busy")).toBe("true");
      expect(toggle.getAttribute("aria-checked")).toBe("false");
    });

    resolve(defaultSettings());
    await waitFor(() => {
      expect(toggle.getAttribute("aria-busy")).not.toBe("true");
    });
  });

  it("reverts autostart toggle when update_settings rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    updateSettings.mockRejectedValue(new Error("schtasks failed"));

    render(<SettingsView settings={defaultSettings()} />);
    const toggle = screen.getByRole("switch", { name: "Start with Windows" });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute("aria-checked")).toBe("true");
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("closes via close_settings", () => {
    render(<SettingsView settings={defaultSettings()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(closeSettings).toHaveBeenCalled();
  });
});
