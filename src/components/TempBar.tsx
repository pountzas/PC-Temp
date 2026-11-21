import type { CSSProperties } from "react";
import { HOT_C, WARM_C } from "../lib/thresholds";
import { barFillToken, type TempLevel } from "../lib/tempColor";

export type TempBarProps = {
  width: number;
  tempC: number | null;
  level: TempLevel;
};

export function TempBar({ width, tempC, level }: TempBarProps) {
  const fillColor = barFillToken(level);
  const clamped = tempC === null ? 0 : Math.max(0, Math.min(100, tempC));
  const fillWidth = tempC === null ? 0 : (width * clamped) / 100;

  const track: CSSProperties = {
    position: "relative",
    width,
    height: 4,
    borderRadius: "var(--radius-pill)",
    background: "var(--color-track)",
    flexShrink: 0,
  };

  const fill: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: fillWidth,
    height: 4,
    borderRadius: "var(--radius-pill)",
    background: fillColor,
    boxShadow: `0 0 8px ${fillColor}`,
  };

  const tick = (leftPx: number, color: string): CSSProperties => ({
    position: "absolute",
    left: leftPx,
    top: -3,
    width: 1,
    height: 10,
    background: color,
  });

  const warmX = (width * WARM_C) / 100;
  const hotX = (width * HOT_C) / 100;

  return (
    <div style={track} data-testid="temp-bar">
      {tempC !== null ? <div style={fill} data-testid="temp-bar-fill" /> : null}
      <div aria-hidden style={tick(warmX, "var(--color-warm)")} />
      <div aria-hidden style={tick(hotX, "var(--color-hot)")} />
    </div>
  );
}
