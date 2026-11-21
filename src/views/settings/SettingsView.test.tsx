// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../ipc/settingsDefaults";
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

  it("persists opacity changes through update_settings", () => {
    updateSettings.mockResolvedValue(defaultSettings());
    render(<SettingsView settings={defaultSettings()} />);

    const slider = screen.getByLabelText("Opacity slider");
    fireEvent.change(slider, { target: { value: "40" } });

    expect(updateSettings).toHaveBeenCalledWith({ opacityPct: 40 });
  });

  it("closes via close_settings", () => {
    render(<SettingsView settings={defaultSettings()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(closeSettings).toHaveBeenCalled();
  });
});
