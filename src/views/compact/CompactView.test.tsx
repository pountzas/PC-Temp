// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURES } from "../../ipc/mock/fixtures";
import { defaultSettings } from "../../ipc/settingsDefaults";
import { CompactView } from "./CompactView";

const headerActions = vi.hoisted(() => ({
  expandView: vi.fn(),
  hideWidget: vi.fn(),
  openSettingsPanel: vi.fn(),
  toggleAlwaysOnTop: vi.fn(),
}));

vi.mock("./compactHeaderActions", () => headerActions);

vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => defaultSettings(),
}));

vi.mock("../../ipc/useSensors", () => ({
  useSensors: () => FIXTURES.compact,
}));

describe("CompactView", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders compact layout with fixture data", () => {
    render(<CompactView />);
    expect(screen.getByTestId("compact-column-cpu")).toBeTruthy();
    expect(screen.getByTestId("compact-column-gpu")).toBeTruthy();
    expect(screen.getByTestId("compact-footer-left").textContent).toBe(
      "UPDATE 1s · 3.90 / 1.15 GHz",
    );
  });

  it("wires header buttons to commands", () => {
    render(<CompactView />);
    const labels = ["Settings", "Expand view", "Always on top", "Hide widget"];
    for (const label of labels) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    expect(headerActions.openSettingsPanel).toHaveBeenCalled();
    expect(headerActions.expandView).toHaveBeenCalled();
    expect(headerActions.toggleAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(headerActions.hideWidget).toHaveBeenCalled();
  });
});
