import { beforeEach, describe, expect, it, vi } from "vitest";
import { setView } from "./view";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("../ipc/tauri", () => ({
  isTauri: () => true,
  mockSensorsEnabled: () => false,
}));

describe("setView", () => {
  beforeEach(() => {
    invoke.mockClear();
    invoke.mockResolvedValue(undefined);
  });

  it("invokes set_view with the view mode", async () => {
    await setView("expanded");
    expect(invoke).toHaveBeenCalledWith("set_view", { view: "expanded" });
  });
});