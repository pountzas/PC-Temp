import type { CSSProperties } from "react";
import type { Celsius, Pct, Units } from "../../ipc/types";
import { formatTemp } from "../../lib/format";
import { pillLoadBarFillPx, PILL_LOAD_BAR_TRACK_PX } from "./pillLoadBarWidth";

export type PillPartProps = {
  label: "CPU" | "GPU";
  accentVar: "--color-cpu" | "--color-gpu";
  tempC: Celsius | null;
  loadPct: Pct | null;
  units: Units;
};

const partRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: "var(--font-weight-bold)",
  fontSize: 11,
  lineHeight: "12px",
  letterSpacing: "0.16em",
};

const metricsCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const tempStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-bold)",
  fontSize: 15,
  lineHeight: "16px",
  color: "var(--color-text)",
};

const track: CSSProperties = {
  position: "relative",
  width: PILL_LOAD_BAR_TRACK_PX,
  height: 3,
  borderRadius: "var(--radius-pill)",
  background: "var(--color-window-border)",
  flexShrink: 0,
};

function tempLabel(tempC: Celsius | null, units: Units): string {
  if (tempC === null) {
    return "—";
  }
  return `${formatTemp(tempC, units)}°`;
}

export function PillPart({
  label,
  accentVar,
  tempC,
  loadPct,
  units,
}: PillPartProps) {
  const fillWidth = pillLoadBarFillPx(loadPct);
  const accent = `var(${accentVar})`;

  const fill: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: fillWidth,
    height: 3,
    borderRadius: "var(--radius-pill)",
    background: accent,
    boxShadow: `0 0 6px ${accent}`,
  };

  return (
    <div style={partRow}>
      <div style={{ ...labelStyle, color: accent }}>{label}</div>
      <div style={metricsCol}>
        <div style={tempStyle}>{tempLabel(tempC, units)}</div>
        <div style={track} data-testid="pill-load-track">
          {fillWidth > 0 ? (
            <div style={fill} data-testid="pill-load-fill" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
