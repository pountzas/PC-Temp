import { isTauri as tauriIsTauri } from "@tauri-apps/api/core";

export function isTauri(): boolean {
  return tauriIsTauri();
}

export function mockSensorsEnabled(): boolean {
  return import.meta.env.VITE_MOCK_SENSORS === "1";
}
