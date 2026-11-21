import type { MHz } from "../../../ipc/types";
import { formatGhz } from "../../../lib/format";

export function formatHotFooterLeft(
  coreClockMHz: MHz | null,
  fanPct: number | null,
): string {
  const parts: string[] = ["TEMP LIMIT"];
  const ghz = formatGhz(coreClockMHz);
  if (ghz !== "—") {
    parts.push(`${ghz} GHz`);
  }
  if (fanPct !== null) {
    parts.push(`FAN ${Math.round(fanPct)}%`);
  }
  return parts.join(" · ");
}
