// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_CHANGED } from "./events";
import { defaultSettings } from "./settingsDefaults";
import type { Settings } from "./types";
import { useSettings } from "./useSettings";

const { listen, getSettings } = vi.hoisted(() => ({
  listen: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("./commands", () => ({ getSettings }));
vi.mock("./tauri", () => ({
  isTauri: () => true,
  mockSensorsEnabled: () => false,
}));

type SettingsHandler = (event: { payload: unknown }) => void;

describe("useSettings", () => {
  let settingsHandler: SettingsHandler | undefined;
  let resolveSettings: ((settings: Settings) => void) | undefined;

  beforeEach(() => {
    settingsHandler = undefined;
    listen.mockImplementation(async (event: string, handler: SettingsHandler) => {
      if (event === SETTINGS_CHANGED) {
        settingsHandler = handler;
      }
      return () => {};
    });
    getSettings.mockImplementation(
      () =>
        new Promise<Settings>((resolve) => {
          resolveSettings = resolve;
        }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies getSettings when no settings-changed event arrived yet", async () => {
    const fromCommand: Settings = { ...defaultSettings(), intervalMs: 5000 };

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(resolveSettings).toBeDefined();
    });

    await act(async () => {
      resolveSettings!(fromCommand);
      await Promise.resolve();
    });

    expect(result.current.intervalMs).toBe(5000);
  });

  it("ignores a stale getSettings reply after settings-changed", async () => {
    const fromEvent: Settings = { ...defaultSettings(), intervalMs: 5000 };
    const fromCommand: Settings = { ...defaultSettings(), intervalMs: 1000 };

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(settingsHandler).toBeDefined();
    });

    act(() => {
      settingsHandler!({ payload: fromEvent });
    });

    expect(result.current.intervalMs).toBe(5000);

    await act(async () => {
      resolveSettings!(fromCommand);
      await Promise.resolve();
    });

    expect(result.current.intervalMs).toBe(5000);
  });
});