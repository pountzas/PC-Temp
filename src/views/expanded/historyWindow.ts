import type { IntervalMs, Pct } from "../../ipc/types";

export function historyPointCount(intervalMs: IntervalMs): number {
  return 60_000 / intervalMs;
}

export function sliceHistory(
  values: (Pct | null)[],
  intervalMs: IntervalMs,
): (Pct | null)[] {
  const count = historyPointCount(intervalMs);
  const tail = values.length > count ? values.slice(-count) : values;
  if (tail.length >= count) {
    return tail;
  }
  const pad = Array<Pct | null>(count - tail.length).fill(null);
  return [...pad, ...tail];
}

export function intervalLiveLabel(intervalMs: IntervalMs): string {
  switch (intervalMs) {
    case 1000:
      return "1s";
    case 2000:
      return "2s";
    case 5000:
      return "5s";
    default: {
      const _exhaustive: never = intervalMs;
      return _exhaustive;
    }
  }
}
