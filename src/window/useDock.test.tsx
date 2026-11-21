// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { defaultSettings } from "../ipc/settingsDefaults";
import type { Settings } from "../ipc/types";
import {
  PILL_LOGICAL_HEIGHT,
  PILL_LOGICAL_WIDTH,
  UNDOCK_PX,
  UNDOCKED_LOGICAL_WIDTH,
} from "./dock";

const mocks = vi.hoisted(() => {
  let movedHandler: (() => void) | undefined;
  const unlisten = vi.fn();
  const setPosition = vi.fn(() => Promise.resolve());
  const outerPosition = vi.fn(() =>
    Promise.resolve({ x: 0, y: 0, type: "Physical" as const }),
  );
  const outerSize = vi.fn(() =>
    Promise.resolve({ width: 0, height: 0, type: "Physical" as const }),
  );
  const onMoved = vi.fn((handler: () => void) => {
    movedHandler = handler;
    return Promise.resolve(unlisten);
  });
  const win = { onMoved, outerPosition, outerSize, setPosition };
  const currentMonitor = vi.fn();
  const setView = vi.fn(() => Promise.resolve());
  const settings = {
    version: 1,
    opacityPct: 90,
    clickThrough: false,
    alwaysOnTop: true,
    units: "C",
    intervalMs: 1000,
    startWithWindows: true,
    accent: "#22E5FF",
    view: "compact",
    lastUndockedView: "compact",
    position: null,
  } as Settings;
  const tauriMock = {
    isTauri: vi.fn(() => true),
    mockSensorsEnabled: vi.fn(() => false),
  };
  return {
    win,
    currentMonitor,
    setView,
    setPosition,
    outerPosition,
    outerSize,
    unlisten,
    settings,
    tauriMock,
    triggerMoved: () => {
      movedHandler?.();
    },
    setMovedHandler: (h: (() => void) | undefined) => {
      movedHandler = h;
    },
  };
});

vi.mock("@tauri-apps/api/window", () => ({
  currentMonitor: mocks.currentMonitor,
  getCurrentWindow: () => mocks.win,
  PhysicalPosition: class {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("./view", () => ({ setView: mocks.setView }));
vi.mock("../ipc/useSettings", () => ({
  useSettings: () => mocks.settings,
}));
vi.mock("../ipc/tauri", () => mocks.tauriMock);

import { useDock } from "./dock";

function monitorWorkArea(width: number, height = 1040): void {
  mocks.currentMonitor.mockResolvedValue({
    scaleFactor: 1,
    workArea: {
      position: { x: 0, y: 0, type: "Physical" as const },
      size: { width, height, type: "Physical" as const },
    },
  });
}

describe("useDock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.setMovedHandler(undefined);
    mocks.unlisten.mockClear();
    mocks.setView.mockClear();
    mocks.setPosition.mockClear();
    mocks.currentMonitor.mockReset();
    mocks.outerPosition.mockReset();
    mocks.outerSize.mockReset();
    mocks.tauriMock.isTauri.mockReturnValue(true);
    mocks.tauriMock.mockSensorsEnabled.mockReturnValue(false);
    mocks.win.onMoved.mockImplementation((handler: () => void) => {
      mocks.setMovedHandler(handler);
      return Promise.resolve(mocks.unlisten);
    });
    Object.assign(mocks.settings, defaultSettings());
    document.documentElement.dataset.docked = "false";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function mountAndSubscribe(): Promise<void> {
    renderHook(() => {
      useDock();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.win.onMoved).toHaveBeenCalled();
  }

  it("debounces two moved events within 150 ms into one evaluation", async () => {
    monitorWorkArea(1920);
    mocks.outerPosition.mockResolvedValue({
      x: 1400,
      y: 200,
      type: "Physical",
    });
    mocks.outerSize.mockResolvedValue({
      width: 320,
      height: 200,
      type: "Physical",
    });
    mocks.settings.view = "compact";

    await mountAndSubscribe();
    act(() => {
      mocks.triggerMoved();
      mocks.triggerMoved();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(mocks.currentMonitor).toHaveBeenCalledOnce();
  });

  it("docks compact with setView pill then setPosition flush right", async () => {
    const workRight = 1920;
    monitorWorkArea(workRight);
    const y = 200;
    mocks.settings.view = "compact";
    mocks.settings.lastUndockedView = "compact";
    mocks.outerPosition.mockResolvedValue({
      x: workRight - 320 - 10,
      y,
      type: "Physical",
    });
    mocks.outerSize.mockResolvedValue({
      width: 320,
      height: 200,
      type: "Physical",
    });

    await mountAndSubscribe();
    await act(async () => {
      mocks.triggerMoved();
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(mocks.setView).toHaveBeenCalledWith("pill");
    expect(mocks.win.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        x: workRight - PILL_LOGICAL_WIDTH,
        y,
      }),
    );
    expect(mocks.setView.mock.invocationCallOrder[0]).toBeLessThan(
      (mocks.win.setPosition as Mock).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("undocks expanded with lastUndockedView and undock X", async () => {
    const workRight = 1920;
    monitorWorkArea(workRight);
    mocks.settings.view = "pill";
    mocks.settings.lastUndockedView = "expanded";
    const gap = UNDOCK_PX + 1;
    mocks.outerPosition.mockResolvedValue({
      x: workRight - PILL_LOGICAL_WIDTH - gap,
      y: 80,
      type: "Physical",
    });
    mocks.outerSize.mockResolvedValue({
      width: PILL_LOGICAL_WIDTH,
      height: PILL_LOGICAL_HEIGHT,
      type: "Physical",
    });
    mocks.setView.mockImplementation(() => {
      mocks.settings.view = "expanded";
      mocks.outerPosition.mockResolvedValue({
        x: workRight - UNDOCKED_LOGICAL_WIDTH.expanded,
        y: 80,
        type: "Physical",
      });
      mocks.outerSize.mockResolvedValue({
        width: UNDOCKED_LOGICAL_WIDTH.expanded,
        height: 540,
        type: "Physical",
      });
      return Promise.resolve();
    });

    await mountAndSubscribe();
    await act(async () => {
      mocks.triggerMoved();
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(mocks.setView).toHaveBeenCalledWith("expanded");
    const expectedX = workRight - UNDOCKED_LOGICAL_WIDTH.expanded - UNDOCK_PX;
    expect(mocks.win.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({ x: expectedX, y: 80 }),
    );
  });

  it("swallows setView rejection without unhandled rejection", async () => {
    monitorWorkArea(1920);
    mocks.settings.view = "compact";
    mocks.outerPosition.mockResolvedValue({
      x: 1590,
      y: 100,
      type: "Physical",
    });
    mocks.outerSize.mockResolvedValue({
      width: 320,
      height: 200,
      type: "Physical",
    });
    mocks.setView.mockRejectedValue(new Error("ipc failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      return;
    });

    await mountAndSubscribe();
    await act(async () => {
      mocks.triggerMoved();
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(warn).toHaveBeenCalledWith("dock evaluate:", expect.any(Error));
    warn.mockRestore();
  });

  it("unsubscribes when unmounted before onMoved resolves", async () => {
    let resolveOnMoved: ((fn: () => void) => void) | undefined;
    mocks.win.onMoved.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveOnMoved = resolve;
        }) as ReturnType<typeof mocks.win.onMoved>,
    );

    const { unmount } = renderHook(() => {
      useDock();
    });
    unmount();
    await act(async () => {
      if (resolveOnMoved) {
        resolveOnMoved(mocks.unlisten);
      }
      await Promise.resolve();
    });

    expect(mocks.unlisten).toHaveBeenCalled();
  });

  it("is a no-op when not in Tauri", async () => {
    mocks.tauriMock.isTauri.mockReturnValue(false);

    renderHook(() => {
      useDock();
    });

    expect(mocks.win.onMoved).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.docked).toBe("false");
  });
});
