// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusClass } from "./focus";

const { onFocusChanged, isFocused, isTauri, mockSensorsEnabled } = vi.hoisted(
  () => ({
    onFocusChanged: vi.fn(),
    isFocused: vi.fn(),
    isTauri: vi.fn(() => true),
    mockSensorsEnabled: vi.fn(() => false),
  }),
);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onFocusChanged,
    isFocused,
  }),
}));

vi.mock("../ipc/tauri", () => ({
  isTauri,
  mockSensorsEnabled,
}));

type FocusHandler = (event: { payload: boolean }) => void;

function defined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`${label} is undefined`);
  }
  return value;
}

describe("useFocusClass", () => {
  let focusHandler: FocusHandler | undefined;
  const unlisten = vi.fn();

  beforeEach(() => {
    focusHandler = undefined;
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-focused");
    isTauri.mockReturnValue(true);
    mockSensorsEnabled.mockReturnValue(false);
    onFocusChanged.mockImplementation(async (handler: FocusHandler) => {
      focusHandler = handler;
      return unlisten;
    });
    isFocused.mockResolvedValue(true);
    unlisten.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts focused without is-unfocused after isFocused resolves", async () => {
    renderHook(() => {
      useFocusClass();
    });

    await waitFor(() => {
      expect(isFocused).toHaveBeenCalled();
    });

    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      false,
    );
  });

  it("adds is-unfocused when the window reports unfocused", async () => {
    isFocused.mockResolvedValue(false);
    renderHook(() => {
      useFocusClass();
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains("is-unfocused")).toBe(
        true,
      );
    });
  });

  it("toggles is-unfocused from onFocusChanged", async () => {
    renderHook(() => {
      useFocusClass();
    });

    await waitFor(() => {
      expect(focusHandler).toBeDefined();
    });

    await act(async () => {
      defined(focusHandler, "focusHandler")({ payload: false });
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      true,
    );

    await act(async () => {
      defined(focusHandler, "focusHandler")({ payload: true });
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      false,
    );
  });

  it("unsubscribes and clears is-unfocused on unmount", async () => {
    const { unmount } = renderHook(() => {
      useFocusClass();
    });

    await waitFor(() => {
      expect(focusHandler).toBeDefined();
    });

    await act(async () => {
      defined(focusHandler, "focusHandler")({ payload: false });
    });

    unmount();

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalledOnce();
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      false,
    );
  });

  it("uses window focus and blur in mock mode", async () => {
    isTauri.mockReturnValue(false);

    renderHook(() => {
      useFocusClass();
    });

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      true,
    );

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      false,
    );
  });

  it("uses window focus and blur when mock sensors are enabled", async () => {
    mockSensorsEnabled.mockReturnValue(true);

    renderHook(() => {
      useFocusClass();
    });

    expect(onFocusChanged).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      true,
    );
  });

  it("does not let a late isFocused() reply override a newer focus event", async () => {
    let resolveFocused: (v: boolean) => void = () => {};
    isFocused.mockReturnValue(
      new Promise<boolean>((r) => {
        resolveFocused = r;
      }),
    );
    renderHook(() => {
      useFocusClass();
    });
    await waitFor(() => {
      expect(focusHandler).toBeDefined();
    });

    await act(async () => {
      defined(focusHandler, "focusHandler")({ payload: false });
    });
    await act(async () => {
      resolveFocused(true);
    });

    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      true,
    );
  });

  it("logs and keeps state when isFocused or onFocusChanged rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    isFocused.mockRejectedValue(new Error("ipc down"));
    onFocusChanged.mockRejectedValue(new Error("listen denied"));

    const { unmount } = renderHook(() => {
      useFocusClass();
    });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(2);
    });
    expect(document.documentElement.classList.contains("is-unfocused")).toBe(
      false,
    );
    unmount();
    warn.mockRestore();
  });
});
