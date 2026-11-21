import type { CSSProperties } from "react";
import { formatPct } from "../lib/format";
import {
  ARC_END_DEG,
  ARC_START_DEG,
  arcPath,
  gaugeCenter,
  gaugeRadius,
  gaugeTicks,
  gaugeValueEndDeg,
  type GaugeSize,
} from "../lib/gaugeGeometry";

export type ArcGaugeProps = {
  loadPct: number | null;
  label?: string;
  size: GaugeSize;
  accent?: string;
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: "var(--font-weight-semibold)",
  fontSize: 10,
  lineHeight: "12px",
  letterSpacing: "0.16em",
  color: "var(--color-muted)",
};

export function ArcGauge({
  loadPct,
  label = "LOAD",
  size,
  accent = "var(--color-accent)",
}: ArcGaugeProps) {
  const { size: S, strokeWidth: sw, valueFontSize: B } = size;
  const c = gaugeCenter(S);
  const r = gaugeRadius(S, sw);
  const trackPath = arcPath(c, c, r, ARC_START_DEG, ARC_END_DEG);
  const hasValue = loadPct !== null;
  const valueEnd = hasValue ? gaugeValueEndDeg(loadPct, size) : ARC_START_DEG;
  const valuePath = hasValue ? arcPath(c, c, r, ARC_START_DEG, valueEnd) : "";
  const ticks = gaugeTicks(S, sw);
  const pctSuffix = Math.floor(B * 0.55);

  const valueBlock: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: "var(--font-weight-bold)",
    fontSize: B,
    lineHeight: `${B + 2}px`,
    letterSpacing: "var(--tracking-tight)",
    color: hasValue ? "var(--color-text)" : "var(--color-faint)",
  };

  const suffix: CSSProperties = {
    fontSize: pctSuffix,
    color: "var(--color-muted)",
  };

  return (
    <div
      style={{ position: "relative", width: S, height: S, flexShrink: 0 }}
      data-testid="arc-gauge"
    >
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
        <path
          d={trackPath}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={sw}
          strokeLinecap="round"
        />
        {hasValue ? (
          <>
            <path
              d={valuePath}
              fill="none"
              stroke={accent}
              strokeOpacity={0.25}
              strokeWidth={sw + 5}
              strokeLinecap="round"
            />
            <path
              d={valuePath}
              fill="none"
              stroke={accent}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          </>
        ) : null}
        {ticks.map((t) => (
          <line
            key={t.percent}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="var(--color-faint)"
            strokeWidth={1}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={valueBlock}>
          {formatPct(loadPct)}
          {hasValue ? <span style={suffix}>%</span> : null}
        </div>
        <div style={labelStyle}>{label}</div>
      </div>
    </div>
  );
}
