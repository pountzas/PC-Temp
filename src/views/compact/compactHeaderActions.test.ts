import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expandView,
  hideWidget,
  openSettingsPanel,
  toggleAlwaysOnTop,
} from "./compactHeaderActions";

const mocks = vi.hoisted(() => ({
  hide: vi.fn(() => Promise.resolve()),
  openSettings: vi.fn(() => Promise.resolve()),
  setView: vi.fn(() => Promise.resolve()),
  updateSettings: vi.fn(() => Promise.resolve()),
  isTauri: vi.fn(() => true),
  warn: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: mocks.hide }),
}));

vi.mock("../../ipc/commands", () => ({
  openSettings: mocks.openSettings,
  updateSettings: mocks.updateSettings,
}));

vi.mock("../../window/view", () => ({
  setView: mocks.setView,
}));

vi.mock("../../ipc/tauri", () => ({
  isTauri: mocks.isTauri,
}));

describe("compactHeaderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    vi.spyOn(console, "warn").mockImplementation(mocks.warn);
  });

  it("hideWidget hides the current window in Tauri", () => {
    hideWidget();
    expect(mocks.hide).toHaveBeenCalled();
  });

  it("hideWidget logs when hide rejects", async () => {
    mocks.hide.mockRejectedValueOnce(new Error("ipc"));
    hideWidget();
    await vi.waitFor(() => {
      expect(mocks.warn).toHaveBeenCalledWith(
        "hide failed:",
        expect.any(Error),
      );
    });
  });

  it("expandView sets expanded view", async () => {
    await expandView();
    expect(mocks.setView).toHaveBeenCalledWith("expanded");
  });

  it("expandView warns when setView rejects", async () => {
    mocks.setView.mockRejectedValueOnce(new Error("ipc"));
    await expandView();
    expect(mocks.warn).toHaveBeenCalledWith(
      "expandView failed:",
      expect.any(Error),
    );
  });

  it("openSettingsPanel invokes open_settings", async () => {
    await openSettingsPanel();
    expect(mocks.openSettings).toHaveBeenCalled();
  });

  it("toggleAlwaysOnTop flips the setting", async () => {
    await toggleAlwaysOnTop(true);
    expect(mocks.updateSettings).toHaveBeenCalledWith({ alwaysOnTop: false });
  });

  it("toggleAlwaysOnTop warns when update_settings rejects", async () => {
    mocks.updateSettings.mockRejectedValueOnce(new Error("ipc"));
    await toggleAlwaysOnTop(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      "toggleAlwaysOnTop failed:",
      expect.any(Error),
    );
  });
});
