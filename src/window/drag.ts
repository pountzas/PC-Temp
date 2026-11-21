import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";
import { isTauri } from "../ipc/tauri";

/** Begin native window drag on primary-button mousedown outside buttons. */
export function startDrag(e: MouseEvent): void {
  if (!isTauri()) {
    return;
  }
  if (e.button !== 0) {
    return;
  }
  const target = e.target;
  if (
    target !== null &&
    typeof target === "object" &&
    "closest" in target &&
    typeof target.closest === "function" &&
    target.closest("button")
  ) {
    return;
  }
  getCurrentWindow().startDragging().catch((err) => {
    console.warn("startDragging failed:", err);
  });
}