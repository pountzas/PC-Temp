import { invoke } from "@tauri-apps/api/core";
import type { Settings, SettingsPatch, SensorTick, ViewMode } from "./types";
import { isTauri, mockSensorsEnabled } from "./tauri";
import { defaultSettings } from "./settingsDefaults";

export async function getSnapshot(): Promise<SensorTick | null> {
  if (!isTauri()) {
    return null;
  }
  return invoke<SensorTick | null>("get_snapshot");
}

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) {
    return defaultSettings();
  }
  return invoke<Settings>("get_settings");
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  if (!isTauri()) {
    return { ...defaultSettings(), ...patch, version: 1 };
  }
  return invoke<Settings>("update_settings", { patch });
}

export async function setView(view: ViewMode): Promise<void> {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  await invoke("set_view", { view });
}

export async function openSettings(): Promise<void> {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  await invoke("open_settings");
}

export async function closeSettings(): Promise<void> {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  await invoke("close_settings");
}

export async function setClickThrough(enabled: boolean): Promise<void> {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  await invoke("set_click_through", { enabled });
}

export async function getAutostart(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  return invoke<boolean>("get_autostart");
}

export async function quitApp(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("quit_app");
}
