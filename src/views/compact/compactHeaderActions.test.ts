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
  });

  it("hideWidget hides the current window in Tauri", () => {
    hideWidget();
    expect(mocks.hide).toHaveBeenCalled();
  });

  it("expandView sets expanded view", async () => {
    await expandView();
    expect(mocks.setView).toHaveBeenCalledWith("expanded");
  });

  it("openSettingsPanel invokes open_settings", async () => {
    await openSettingsPanel();
    expect(mocks.openSettings).toHaveBeenCalled();
  });

  it("toggleAlwaysOnTop flips the setting", async () => {
    await toggleAlwaysOnTop(true);
    expect(mocks.updateSettings).toHaveBeenCalledWith({ alwaysOnTop: false });
  });
});
