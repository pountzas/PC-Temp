import { invoke } from "@tauri-apps/api/core";
import { isTauri, mockSensorsEnabled } from "../ipc/tauri";
import type { ViewMode } from "../ipc/types";

export async function setView(view: ViewMode): Promise<void> {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  await invoke("set_view", { view });
}
