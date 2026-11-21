import type { Pct } from "../ipc/types";

export type SparklineProps = {
  width: number;
  height?: number;
  values: (Pct | null)[];
  accent?: string;
  label?: string;
};

export function Sparkline({
  width,
  height = 30,
  values,
  accent = "var(--color-accent)",
  label = "LOAD %",
}: SparklineProps) {
  const mid = height / 2;
  const lastIndex = Math.max(values.length - 1, 1);

  const points: { x: number; y: number; valid: boolean }[] = values.map(
    (v, i) => ({
      x: i * (width / lastIndex),
      y: v === null ? mid : height - (v / 100) * height,
      valid: v !== null,
    }),
  );

  const validPoints = points.filter((p) => p.valid);
  const line =
    validPoints.length > 0
      ? validPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      : "";

  const area =
    validPoints.length > 0 ? `0,${height} ${line} ${width},${height}` : "";

  const last = validPoints.at(-1);

  const labelRow = {
    position: "absolute" as const,
    left: 0,
    top: height + 2,
    width,
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    lineHeight: "11px",
    color: "var(--color-faint)",
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height: height + 14,
        flexShrink: 0,
      }}
      data-testid="sparkline"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
        <line
          x1={0}
          y1={mid}
          x2={width}
          y2={mid}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        {area ? (
          <polygon points={area} fill={accent} fillOpacity={0.12} />
        ) : null}
        {line ? (
          <polyline
            points={line}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}
        {last ? <circle cx={last.x} cy={last.y} r={2.5} fill={accent} /> : null}
      </svg>
      <div style={labelRow}>
        <span>-60s</span>
        <span>{label}</span>
        <span>now</span>
      </div>
    </div>
  );
}
