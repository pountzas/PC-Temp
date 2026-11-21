import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

/** Begin native window drag on primary-button mousedown outside buttons. */
export function startDrag(e: MouseEvent): void {
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
  void getCurrentWindow().startDragging();
}