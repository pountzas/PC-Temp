import { getCurrentWindow } from "@tauri-apps/api/window";
import { openSettings, updateSettings } from "../../ipc/commands";
import { isTauri } from "../../ipc/tauri";
import type { Settings } from "../../ipc/types";
import { setView } from "../../window/view";

export function hideWidget(): void {
  if (!isTauri()) {
    return;
  }
  getCurrentWindow()
    .hide()
    .catch((err: unknown) => {
      console.warn("hide failed:", err);
    });
}

export async function toggleAlwaysOnTop(
  alwaysOnTop: Settings["alwaysOnTop"],
): Promise<void> {
  await updateSettings({ alwaysOnTop: !alwaysOnTop });
}

export async function expandView(): Promise<void> {
  await setView("expanded");
}

export async function openSettingsPanel(): Promise<void> {
  await openSettings();
}
