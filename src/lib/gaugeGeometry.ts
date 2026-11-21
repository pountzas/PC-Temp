/** SVG arc geometry ported from docs/spec/gen.py (`polar`, `arc`, `gauge`). */

export const ARC_START_DEG = 135;
export const ARC_SPAN_DEG = 270;
export const ARC_END_DEG = ARC_START_DEG + ARC_SPAN_DEG;

export type GaugeSize = {
  size: number;
  strokeWidth: number;
  valueFontSize: number;
};

export const GAUGE_COMPACT: GaugeSize = {
  size: 62,
  strokeWidth: 5,
  valueFontSize: 18,
};
export const GAUGE_EXPANDED: GaugeSize = {
  size: 84,
  strokeWidth: 6,
  valueFontSize: 22,
};

export function gaugeRadius(size: number, strokeWidth: number): number {
  return size / 2 - strokeWidth / 2 - 3;
}

export function gaugeValueEndDeg(loadPct: number, _size: GaugeSize): number {
  const clamped = Math.max(0, Math.min(100, loadPct));
  return ARC_START_DEG + ARC_SPAN_DEG * (clamped / 100);
}

export function polar(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function gaugeCenter(size: number): number {
  return size / 2;
}

export type GaugeTick = {
  percent: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function gaugeTicks(
  size: number,
  strokeWidth: number,
  percents: readonly number[] = [0, 50, 100],
): GaugeTick[] {
  const c = gaugeCenter(size);
  const r = gaugeRadius(size, strokeWidth);
  const inner = r + strokeWidth / 2 + 1;
  const outer = r + strokeWidth / 2 + 3.5;
  return percents.map((percent) => {
    const angle = ARC_START_DEG + ARC_SPAN_DEG * (percent / 100);
    const [x1, y1] = polar(c, c, inner, angle);
    const [x2, y2] = polar(c, c, outer, angle);
    return { percent, x1, y1, x2, y2 };
  });
}
