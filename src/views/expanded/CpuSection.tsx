import type { SensorTick, Units } from "../../ipc/types";
import { formatGhz, formatNull, formatTemp } from "../../lib/format";
import { GAUGE_EXPANDED } from "../../lib/gaugeGeometry";
import { levelForTempC } from "../../lib/tempColor";
import { ArcGauge } from "../../components/ArcGauge";
import { Sparkline } from "../../components/Sparkline";
import { TempBar } from "../../components/TempBar";
import { CoreCell } from "./CoreCell";
import { ExpandedStat } from "./ExpandedStat";
import { formatCoreThreadLabel } from "./formatCoreThread";
import { sliceHistory } from "./historyWindow";

const SPARKLINE_WIDTH = 384;
const CONTENT_WIDTH = 284;

export type CpuSectionProps = {
  tick: SensorTick;
  units: Units;
};

function formatBaseGhzText(mhz: number): string {
  return (mhz / 1000).toFixed(1);
}

export function CpuSection({ tick, units }: CpuSectionProps) {
  const { cpu, history, intervalMs } = tick;
  const model = `${cpu.name} · ${formatCoreThreadLabel(cpu)}`;
  const clockRight =
    cpu.clockMHz === null ? "—" : `${formatGhz(cpu.clockMHz)} GHz`;
  const clockRightColor =
    cpu.clockMHz === null ? "var(--color-faint)" : "var(--color-text)";

  const packageText = formatTemp(cpu.packageTempC, units);
  const powerText = formatNull(cpu.packagePowerW);
  const baseText = formatBaseGhzText(cpu.baseClockMHz);

  const sparkValues = sliceHistory(history.cpuLoad, intervalMs);

  const cores = cpu.cores.slice(0, 4);

  const tempLevel = levelForTempC(cpu.packageTempC, tick, "cpu");

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      data-testid="cpu-section"
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
              color: "var(--color-cpu)",
            }}
          >
            CPU
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              lineHeight: "14px",
              color: "var(--color-muted)",
            }}
          >
            {model}
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
          loadPct={cpu.loadPct}
          size={GAUGE_EXPANDED}
          accent="var(--color-cpu)"
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
              label="PACKAGE"
              text={packageText}
              unit={units === "F" ? "°F" : "°C"}
            />
            <ExpandedStat label="POWER" text={powerText} unit="W" />
            <ExpandedStat label="BASE" text={baseText} unit="GHz" />
          </div>
          <TempBar
            width={CONTENT_WIDTH}
            tempC={cpu.packageTempC}
            level={tempLevel}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {cores.map((core) => (
          <CoreCell key={core.index} core={core} units={units} />
        ))}
      </div>

      <Sparkline
        width={SPARKLINE_WIDTH}
        values={sparkValues}
        accent="var(--color-cpu)"
      />
    </section>
  );
}
