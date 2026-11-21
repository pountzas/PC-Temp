import type { CSSProperties } from "react";
import type { IntervalMs, SensorTick } from "../../ipc/types";
import { formatClock } from "../../lib/format";
import { formatFooterLeft } from "./formatFooterLeft";

export type CompactFooterProps = {
  tick: SensorTick | null;
  intervalMs: IntervalMs;
};

const footerRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "auto",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  lineHeight: "11px",
  color: "var(--color-faint)",
};

export function CompactFooter({ tick, intervalMs }: CompactFooterProps) {
  const left = tick
    ? formatFooterLeft(intervalMs, tick.cpu.clockMHz, tick.gpu.coreClockMHz)
    : formatFooterLeft(intervalMs, null, null);
  const right = tick ? formatClock(tick.ts) : "—";

  return (
    <footer style={footerRow} data-testid="compact-footer">
      <span data-testid="compact-footer-left">{left}</span>
      <span data-testid="compact-footer-clock">{right}</span>
    </footer>
  );
}
