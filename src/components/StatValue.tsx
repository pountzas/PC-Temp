import type { ReactNode } from "react";
import { formatNull } from "../lib/format";

export type StatValueProps = {
  label: string;
  value: number | null;
  unit: ReactNode;
  valueSize?: number;
  color?: string;
};

export function StatValue({
  label,
  value,
  unit,
  valueSize = 20,
  color = "var(--color-text)",
}: StatValueProps) {
  const unitSize = Math.round(valueSize * 0.55);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 2, width: 80 }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: "var(--font-weight-semibold)",
          fontSize: 10,
          lineHeight: "12px",
          letterSpacing: "0.16em",
          color: "var(--color-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-bold)",
          fontSize: valueSize,
          lineHeight: `${valueSize + 2}px`,
          letterSpacing: "var(--tracking-tight)",
          color,
        }}
      >
        {formatNull(value)}
        <span
          style={{
            fontSize: unitSize,
            color: "var(--color-muted)",
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}
