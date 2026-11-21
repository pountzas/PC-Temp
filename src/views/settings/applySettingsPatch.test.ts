import { describe, expect, it, vi } from "vitest";
import { applySettingsPatch } from "./applySettingsPatch";

const { updateSettings } = vi.hoisted(() => ({
  updateSettings: vi.fn(),
}));

vi.mock("../../ipc/commands", () => ({
  updateSettings,
}));

describe("applySettingsPatch", () => {
  it("logs and swallows update_settings rejections", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    updateSettings.mockRejectedValue(new Error("schtasks failed"));

    await applySettingsPatch({ alwaysOnTop: false });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
