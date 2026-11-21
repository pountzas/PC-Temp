import type { GpuSnapshot } from "../../ipc/types";
import { formatVramGiB, vramFillRatio } from "./formatVram";

const CONTENT_WIDTH = 284;

export type VramBlockProps = {
  gpu: GpuSnapshot;
};

export function VramBlock({ gpu }: VramBlockProps) {
  const label = formatVramGiB(gpu.vramUsedMiB, gpu.vramTotalMiB);
  const ratio = vramFillRatio(gpu.vramUsedMiB, gpu.vramTotalMiB);
  const faint = label === "—";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        width: CONTENT_WIDTH,
      }}
      data-testid="vram-block"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: 10,
            lineHeight: "12px",
            letterSpacing: "0.16em",
            color: "var(--color-muted)",
          }}
        >
          VRAM
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            lineHeight: "12px",
            letterSpacing: 0,
            color: faint ? "var(--color-faint)" : "var(--color-text)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          width: CONTENT_WIDTH,
          height: 4,
          borderRadius: "var(--radius-pill)",
          background: "var(--color-track)",
        }}
      >
        {ratio !== null ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CONTENT_WIDTH * ratio,
              height: 4,
              borderRadius: "var(--radius-pill)",
              background: "var(--color-gpu)",
              boxShadow: "0 0 8px var(--color-gpu)",
            }}
            data-testid="vram-bar-fill"
          />
        ) : null}
      </div>
    </div>
  );
}
