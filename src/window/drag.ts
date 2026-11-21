import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";
import { isTauri } from "../ipc/tauri";

type ClosestTarget = { closest(selectors: string): Element | null };

function isClosestTarget(target: unknown): target is ClosestTarget {
  return (
    typeof target === "object" &&
    target !== null &&
    "closest" in target &&
    typeof (target as ClosestTarget).closest === "function"
  );
}

/** Begin native window drag on primary-button mousedown outside buttons. */
export function startDrag(e: MouseEvent): void {
  if (!isTauri()) {
    return;
  }
  if (e.button !== 0) {
    return;
  }
  if (isClosestTarget(e.target) && e.target.closest("button") !== null) {
    return;
  }
  getCurrentWindow()
    .startDragging()
    .catch((err: unknown) => {
      console.warn("startDragging failed:", err);
    });
}
