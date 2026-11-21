import type { AlertComponent, SensorTick } from "../ipc/types";
import { HOT_C, WARM_C } from "./thresholds";

export type TempLevel = "normal" | "warn" | "hot";

function levelFromAlerts(
  tick: SensorTick,
  component: AlertComponent,
): TempLevel {
  const hot = tick.alerts.some(
    (a) => a.component === component && a.level === "hot",
  );
  if (hot) {
    return "hot";
  }
  const warm = tick.alerts.some(
    (a) => a.component === component && a.level === "warm",
  );
  if (warm) {
    return "warn";
  }
  return "normal";
}

function levelFromTempC(tempC: number): TempLevel {
  if (tempC >= HOT_C) {
    return "hot";
  }
  if (tempC >= WARM_C) {
    return "warn";
  }
  return "normal";
}

export function levelForTempC(
  tempC: number | null,
  tick: SensorTick | null,
  component: AlertComponent,
): TempLevel {
  if (tick !== null) {
    return levelFromAlerts(tick, component);
  }
  if (tempC === null) {
    return "normal";
  }
  return levelFromTempC(tempC);
}

export function textColorToken(level: TempLevel): string {
  switch (level) {
    case "normal":
      return "var(--color-text)";
    case "warn":
      return "var(--color-warm)";
    case "hot":
      return "var(--color-hot)";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function barFillToken(level: TempLevel): string {
  switch (level) {
    case "normal":
      return "var(--color-accent)";
    case "warn":
      return "var(--color-warm)";
    case "hot":
      return "var(--color-hot)";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}
