import type { ReactNode } from "react";

export type ExpandedStatProps = {
  label: string;
  text: string;
  unit: ReactNode;
};

export function ExpandedStat({ label, text, unit }: ExpandedStatProps) {
  const faint = text === "—";

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
          fontSize: 20,
          lineHeight: "22px",
          letterSpacing: "var(--tracking-tight)",
          color: faint ? "var(--color-faint)" : "var(--color-text)",
        }}
      >
        {text}
        {!faint ? (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-muted)",
            }}
          >
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
