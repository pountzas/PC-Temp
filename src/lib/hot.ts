import type { SensorTick } from "../ipc/types";

export function isGpuHot(tick: SensorTick | null): boolean {
  if (tick === null) {
    return false;
  }
  return tick.alerts.some(
    (alert) => alert.component === "gpu" && alert.level === "hot",
  );
}
