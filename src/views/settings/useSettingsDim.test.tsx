// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_WINDOW } from "../../ipc/events";
import { defaultSettings } from "../../ipc/settingsDefaults";
import type { SettingsWindowPayload } from "../../ipc/events";
import { useSettingsDim } from "./useSettingsDim";

const { listen } = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("../../ipc/tauri", () => ({
  isTauri: () => true,
  mockSensorsEnabled: () => false,
}));

type WindowHandler = (event: { payload: SettingsWindowPayload }) => void;

function defined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} is undefined`);
  }
  return value;
}

describe("useSettingsDim", () => {
  let windowHandler: WindowHandler | undefined;
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  beforeEach(() => {
    windowHandler = undefined;
    root.className = "";
    root.removeAttribute("style");
    document.documentElement.removeAttribute("style");
    listen.mockImplementation(async (event: string, handler: WindowHandler) => {
      if (event === SETTINGS_WINDOW) {
        windowHandler = handler;
      }
      return () => {};
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      opacityPct: 72,
      accent: "#B65CFF" as const,
      alpha: "0.72",
    },
    {
      opacityPct: 0,
      accent: "#22E5FF" as const,
      alpha: "0",
    },
    {
      opacityPct: 100,
      accent: "#FFB020" as const,
      alpha: "1",
    },
  ])(
    "sets panel alpha $alpha and accent $accent from settings",
    async ({ opacityPct, accent, alpha }) => {
      const settings = { ...defaultSettings(), opacityPct, accent };

      renderHook(() => {
        useSettingsDim(settings);
      });

      await waitFor(() => {
        expect(
          document.documentElement.style.getPropertyValue("--panel-bg-alpha"),
        ).toBe(alpha);
      });
      expect(
        document.documentElement.style.getPropertyValue("--color-accent"),
      ).toBe(accent);
    },
  );

  it("clears CSS variables on unmount", async () => {
    const { unmount } = renderHook(() => {
      useSettingsDim(defaultSettings());
    });

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--panel-bg-alpha"),
      ).not.toBe("");
    });

    unmount();

    expect(
      document.documentElement.style.getPropertyValue("--panel-bg-alpha"),
    ).toBe("");
    expect(
      document.documentElement.style.getPropertyValue("--color-accent"),
    ).toBe("");
  });

  it("dims widget content while settings window is open", async () => {
    renderHook(() => {
      useSettingsDim(defaultSettings());
    });

    await waitFor(() => {
      expect(windowHandler).toBeDefined();
    });

    act(() => {
      defined(windowHandler, "windowHandler")({ payload: { open: true } });
    });

    expect(root.classList.contains("is-settings-dimmed")).toBe(true);

    act(() => {
      defined(windowHandler, "windowHandler")({ payload: { open: false } });
    });

    expect(root.classList.contains("is-settings-dimmed")).toBe(false);
  });
});
