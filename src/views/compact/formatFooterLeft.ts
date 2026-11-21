import type { IntervalMs, MHz } from "../../ipc/types";
import { formatGhz } from "../../lib/format";

export function formatFooterLeft(
  intervalMs: IntervalMs,
  cpuClockMHz: MHz | null,
  gpuClockMHz: MHz | null,
): string {
  const sec = intervalMs / 1000;
  return `UPDATE ${sec}s · ${formatGhz(cpuClockMHz)} / ${formatGhz(gpuClockMHz)} GHz`;
}
