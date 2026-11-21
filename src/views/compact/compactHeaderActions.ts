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
  try {
    await updateSettings({ alwaysOnTop: !alwaysOnTop });
  } catch (err: unknown) {
    console.warn("toggleAlwaysOnTop failed:", err);
  }
}

export async function expandView(): Promise<void> {
  try {
    await setView("expanded");
  } catch (err: unknown) {
    console.warn("expandView failed:", err);
  }
}

export async function openSettingsPanel(): Promise<void> {
  try {
    await openSettings();
  } catch (err: unknown) {
    console.warn("openSettingsPanel failed:", err);
  }
}
