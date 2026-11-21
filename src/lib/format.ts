import type { MHz, Units } from "../ipc/types";

const EM_DASH = "—";

export function formatNull(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EM_DASH;
  }
  return String(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EM_DASH;
  }
  return String(Math.round(value));
}

export function formatTemp(
  celsius: number | null | undefined,
  units: Units,
): string {
  if (celsius === null || celsius === undefined) {
    return EM_DASH;
  }
  if (units === "F") {
    return String(Math.round((celsius * 9) / 5 + 32));
  }
  return String(Math.round(celsius));
}

export function formatGhz(mhz: MHz | null | undefined): string {
  if (mhz === null || mhz === undefined) {
    return EM_DASH;
  }
  return (mhz / 1000).toFixed(2);
}

export function formatClock(tsMs: number): string {
  const d = new Date(tsMs);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const s = d.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
