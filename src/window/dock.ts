import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { useSettings } from "../ipc/useSettings";
import type { UndockedView, ViewMode } from "../ipc/types";
import { isTauri, mockSensorsEnabled } from "../ipc/tauri";
import { setView } from "./view";

/** [guess] */
const DEBOUNCE_MS = 150;
/** [guess] */
export const DOCK_PX = 16;
/** [guess] */
export const UNDOCK_PX = 40;

export const PILL_LOGICAL_WIDTH = 220;
export const PILL_LOGICAL_HEIGHT = 44;

// Keep in sync with view_logical_size in src-tauri/src/window/layout.rs
export const UNDOCKED_LOGICAL_WIDTH: Record<UndockedView, number> = {
  compact: 320,
  expanded: 420,
};

export type PhysicalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DecideDockState = {
  view: ViewMode;
  lastUndockedView: UndockedView;
};

export type DecideDockResult =
  | { action: "stay" }
  | { action: "dock"; x: number; y: number }
  | { action: "undock"; x: number };

function rectRight(r: PhysicalRect): number {
  return r.x + r.width;
}

function rectBottom(r: PhysicalRect): number {
  return r.y + r.height;
}

function gapToWorkAreaRight(
  windowRect: PhysicalRect,
  workArea: PhysicalRect,
): number {
  return rectRight(workArea) - rectRight(windowRect);
}

function pillPhysicalSize(scaleFactor: number): {
  width: number;
  height: number;
} {
  return {
    width: PILL_LOGICAL_WIDTH * scaleFactor,
    height: PILL_LOGICAL_HEIGHT * scaleFactor,
  };
}

function clampPillTop(
  y: number,
  workArea: PhysicalRect,
  pillHeight: number,
): number {
  const minY = workArea.y;
  const maxY = rectBottom(workArea) - pillHeight;
  if (maxY < minY) {
    return minY;
  }
  return Math.min(Math.max(y, minY), maxY);
}

export function decideDock(
  windowRect: PhysicalRect,
  workArea: PhysicalRect,
  state: DecideDockState,
  scaleFactor: number,
): DecideDockResult {
  const gap = gapToWorkAreaRight(windowRect, workArea);

  if (state.view === "pill") {
    if (gap > UNDOCK_PX) {
      const restoredWidth =
        UNDOCKED_LOGICAL_WIDTH[state.lastUndockedView] * scaleFactor;
      const x = Math.max(
        workArea.x,
        Math.min(windowRect.x, rectRight(workArea) - restoredWidth - UNDOCK_PX),
      );
      return { action: "undock", x };
    }
    return { action: "stay" };
  }

  if (gap <= DOCK_PX) {
    const pill = pillPhysicalSize(scaleFactor);
    const x = rectRight(workArea) - pill.width;
    const y = clampPillTop(windowRect.y, workArea, pill.height);
    return { action: "dock", x, y };
  }

  return { action: "stay" };
}

function workAreaFromMonitor(
  monitor: NonNullable<Awaited<ReturnType<typeof currentMonitor>>>,
): {
  workArea: PhysicalRect;
  scaleFactor: number;
} {
  const { workArea, scaleFactor } = monitor;
  return {
    scaleFactor,
    workArea: {
      x: workArea.position.x,
      y: workArea.position.y,
      width: workArea.size.width,
      height: workArea.size.height,
    },
  };
}

function setDockedDataset(docked: boolean): void {
  document.documentElement.dataset.docked = docked ? "true" : "false";
}

async function applyDockDecision(
  result: DecideDockResult,
  lastUndockedView: UndockedView,
): Promise<void> {
  switch (result.action) {
    case "stay":
      return;
    case "undock":
      setDockedDataset(false);
      await setView(lastUndockedView);
      {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        await win.setPosition(
          new PhysicalPosition(Math.round(result.x), pos.y),
        );
      }
      return;
    case "dock":
      setDockedDataset(true);
      await setView("pill");
      await getCurrentWindow().setPosition(
        new PhysicalPosition(Math.round(result.x), Math.round(result.y)),
      );
      return;
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

function readDisposed(lifecycle: { disposed: boolean }): boolean {
  return lifecycle.disposed;
}

export function useDock(): void {
  const settings = useSettings();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    setDockedDataset(settings.view === "pill");
  }, [settings]);

  useEffect(() => {
    if (!isTauri() || mockSensorsEnabled()) {
      setDockedDataset(false);
      return;
    }

    const window = getCurrentWindow();
    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const lifecycle = { disposed: false };
    let evaluating = false;
    let rerun = false;

    const scheduleEvaluate = () => {
      if (debounceId !== undefined) {
        clearTimeout(debounceId);
      }
      debounceId = setTimeout(() => {
        debounceId = undefined;
        void runEvaluate();
      }, DEBOUNCE_MS);
    };

    async function runEvaluate(): Promise<void> {
      if (evaluating) {
        rerun = true;
        return;
      }
      evaluating = true;
      try {
        await evaluatePosition();
      } catch (err: unknown) {
        console.warn("dock evaluate:", err);
      } finally {
        evaluating = false;
        if (rerun && !lifecycle.disposed) {
          rerun = false;
          scheduleEvaluate();
        }
      }
    }

    async function evaluatePosition(): Promise<void> {
      const monitor = await currentMonitor();
      if (lifecycle.disposed || monitor === null) {
        return;
      }
      const { workArea, scaleFactor } = workAreaFromMonitor(monitor);
      const [position, size] = await Promise.all([
        window.outerPosition(),
        window.outerSize(),
      ]);
      if (readDisposed(lifecycle)) {
        return;
      }
      const windowRect: PhysicalRect = {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };
      const { view, lastUndockedView } = settingsRef.current;
      const result = decideDock(
        windowRect,
        workArea,
        { view, lastUndockedView },
        scaleFactor,
      );
      await applyDockDecision(result, lastUndockedView);
    }

    let unlistenMove: (() => void) | undefined;
    void window
      .onMoved(() => {
        scheduleEvaluate();
      })
      .then((unlisten) => {
        if (lifecycle.disposed) {
          unlisten();
          return;
        }
        unlistenMove = unlisten;
      })
      .catch((err: unknown) => {
        console.warn("dock onMoved:", err);
      });

    return () => {
      lifecycle.disposed = true;
      if (debounceId !== undefined) {
        clearTimeout(debounceId);
      }
      unlistenMove?.();
    };
  }, []);
}
