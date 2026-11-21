import type { SensorTick, Units } from "../../ipc/types";
import { formatGhz, formatNull, formatTemp } from "../../lib/format";
import { GAUGE_EXPANDED } from "../../lib/gaugeGeometry";
import { ArcGauge } from "../../components/ArcGauge";
import { Sparkline } from "../../components/Sparkline";
import { ExpandedStat } from "./ExpandedStat";
import { sliceHistory } from "./historyWindow";
import { VramBlock } from "./VramBlock";

const SPARKLINE_WIDTH = 384;
const CONTENT_WIDTH = 284;

export type GpuSectionProps = {
  tick: SensorTick;
  units: Units;
};

export function GpuSection({ tick, units }: GpuSectionProps) {
  const { gpu, history, intervalMs } = tick;
  const clockRight =
    gpu.coreClockMHz === null ? "—" : `${formatGhz(gpu.coreClockMHz)} GHz`;
  const clockRightColor =
    gpu.coreClockMHz === null ? "var(--color-faint)" : "var(--color-text)";

  const coreText = formatTemp(gpu.coreTempC, units);
  const fanText = formatNull(gpu.fanPct);

  const sparkValues = sliceHistory(history.gpuLoad, intervalMs);

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      data-testid="gpu-section"
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: "var(--font-weight-bold)",
              fontSize: 15,
              lineHeight: "16px",
              letterSpacing: "0.2em",
              color: "var(--color-gpu)",
            }}
          >
            GPU
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              lineHeight: "14px",
              color: "var(--color-muted)",
            }}
          >
            {gpu.name}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: "14px",
            color: clockRightColor,
          }}
        >
          {clockRight}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ArcGauge
          loadPct={gpu.loadPct}
          size={GAUGE_EXPANDED}
          accent="var(--color-gpu)"
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flex: 1,
            minWidth: 0,
            width: CONTENT_WIDTH,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <ExpandedStat
              label="CORE"
              text={coreText}
              unit={units === "F" ? "°F" : "°C"}
            />
            <ExpandedStat label="FAN" text={fanText} unit="%" />
          </div>
          <VramBlock gpu={gpu} />
        </div>
      </div>

      <Sparkline
        width={SPARKLINE_WIDTH}
        values={sparkValues}
        accent="var(--color-gpu)"
      />
    </section>
  );
}
