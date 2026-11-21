import type { Pct } from "../ipc/types";

export type SparklineProps = {
  width: number;
  height?: number;
  values: (Pct | null)[];
  accent?: string;
  label?: string;
};

function formatPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function buildSegments(
  width: number,
  height: number,
  values: (Pct | null)[],
): { x: number; y: number }[][] {
  const lastIndex = Math.max(values.length - 1, 1);
  const step = width / lastIndex;
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) {
        segments.push(current);
      }
      current = [];
      return;
    }
    const pct = Math.max(0, Math.min(100, v));
    current.push({ x: i * step, y: height - (pct / 100) * height });
  });

  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

export function Sparkline({
  width,
  height = 30,
  values,
  accent = "var(--color-accent)",
  label = "LOAD %",
}: SparklineProps) {
  const mid = height / 2;
  const segments = buildSegments(width, height, values);
  const newestIsReal = values.length > 0 && values.at(-1) !== null;
  const lastPoint = newestIsReal ? segments.at(-1)?.at(-1) : undefined;

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
        {segments.map((seg, i) => {
          if (seg.length === 0) {
            return null;
          }
          const first = seg[0];
          const end = seg[seg.length - 1];
          const line = formatPoints(seg);
          const area = `${first.x.toFixed(1)},${height} ${line} ${end.x.toFixed(1)},${height}`;
          return (
            <g key={i}>
              <polygon points={area} fill={accent} fillOpacity={0.12} />
              <polyline
                points={line}
                fill="none"
                stroke={accent}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {lastPoint ? (
          <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={accent} />
        ) : null}
      </svg>
      <div style={labelRow}>
        <span>-60s</span>
        <span>{label}</span>
        <span>now</span>
      </div>
    </div>
  );
}
