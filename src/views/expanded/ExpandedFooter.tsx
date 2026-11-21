import type { IntervalMs, Units } from "../../ipc/types";
import { intervalLiveLabel } from "./historyWindow";

export type ExpandedFooterProps = {
  intervalMs: IntervalMs;
  units: Units;
};

export function ExpandedFooter({ intervalMs, units }: ExpandedFooterProps) {
  const unitGlyph = units === "F" ? "°F" : "°C";

  return (
    <footer
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "auto",
        paddingTop: 10,
        borderTop: "1px solid var(--color-divider)",
        flexShrink: 0,
      }}
      data-testid="expanded-footer"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          lineHeight: "12px",
          color: "var(--color-muted)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-live)",
            boxShadow: "0 0 6px var(--color-live)",
            flexShrink: 0,
          }}
        />
        LIVE · updates every {intervalLiveLabel(intervalMs)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          lineHeight: "12px",
          color: "var(--color-faint)",
        }}
      >
        {unitGlyph} · 60s window
      </div>
    </footer>
  );
}
