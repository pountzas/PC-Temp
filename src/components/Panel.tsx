import type { CSSProperties, ReactNode } from "react";

export type PanelProps = {
  padding: number | string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const scanlineOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)",
};

const bgLayer: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background: "var(--color-mica-inactive)",
  opacity: "var(--panel-bg-alpha, 0)",
};

export function Panel({ padding, children, className, style }: PanelProps) {
  const shell: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    padding,
    ...style,
  };

  return (
    <div className={className} style={shell}>
      <div aria-hidden style={bgLayer} data-testid="panel-bg-layer" />
      <div aria-hidden style={scanlineOverlay} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
