import type { CSSProperties } from "react";
import type { CpuCoreReading, Units } from "../../ipc/types";
import { formatPct, formatTemp } from "../../lib/format";

export type CoreCellProps = {
  core: CpuCoreReading;
  units: Units;
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: "var(--font-weight-semibold)",
  fontSize: 10,
  lineHeight: "12px",
  letterSpacing: "0.16em",
  color: "var(--color-muted)",
};

export function CoreCell({ core, units }: CoreCellProps) {
  const tempText =
    core.tempC === null ? "—" : `${formatTemp(core.tempC, units)}°`;
  const loadText = core.loadPct === null ? "—" : `${formatPct(core.loadPct)}%`;
  const loadWidth =
    core.loadPct === null ? 0 : Math.max(0, Math.min(100, core.loadPct));

  const tempColor =
    core.tempC === null ? "var(--color-faint)" : "var(--color-text)";
  const loadColor =
    core.loadPct === null ? "var(--color-faint)" : "var(--color-muted)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        width: 84,
      }}
      data-testid={`core-cell-${core.index}`}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={labelStyle}>CORE {core.index}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-bold)",
            fontSize: 13,
            lineHeight: "14px",
            color: tempColor,
          }}
        >
          {tempText}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            position: "relative",
            width: 56,
            height: 3,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-track)",
            flexShrink: 0,
          }}
        >
          {loadWidth > 0 ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: (56 * loadWidth) / 100,
                height: 3,
                borderRadius: "var(--radius-pill)",
                background: "var(--color-cpu)",
                boxShadow: "0 0 6px var(--color-cpu)",
              }}
            />
          ) : null}
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            lineHeight: "10px",
            color: loadColor,
          }}
        >
          {loadText}
        </span>
      </div>
    </div>
  );
}
