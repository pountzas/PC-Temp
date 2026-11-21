import type { CSSProperties } from "react";
import { ArcGauge } from "../../components/ArcGauge";
import { TempBar } from "../../components/TempBar";
import type { AlertComponent, SensorTick, Units } from "../../ipc/types";
import { GAUGE_COMPACT } from "../../lib/gaugeGeometry";
import { formatTemp } from "../../lib/format";
import {
  levelForTempC,
  textColorToken,
  type TempLevel,
} from "../../lib/tempColor";
import { stripModelName } from "./stripModelName";

export type CompactColumnOverrides = {
  gaugeAccent?: string;
  /** Forces bar/text level (e.g. hot state in #20). */
  tempLevel?: TempLevel;
};

export type CompactColumnProps = {
  component: AlertComponent;
  loadPct: number | null;
  tempC: number | null;
  modelName: string;
  units: Units;
  tick: SensorTick | null;
  overrides?: CompactColumnOverrides;
};

const columnShell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: 140,
};

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const textCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

function labelStyle(accent: string): CSSProperties {
  return {
    fontFamily: "var(--font-display)",
    fontWeight: "var(--font-weight-bold)",
    fontSize: 13,
    lineHeight: "14px",
    letterSpacing: "0.18em",
    color: accent,
  };
}

const modelStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: "var(--font-weight-regular)",
  fontSize: 10,
  lineHeight: "12px",
  color: "var(--color-faint)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function unitSuffix(units: Units): string {
  return units === "F" ? "°F" : "°C";
}

export function CompactColumn({
  component,
  loadPct,
  tempC,
  modelName,
  units,
  tick,
  overrides,
}: CompactColumnProps) {
  const isCpu = component === "cpu";
  const roleAccent = isCpu ? "var(--color-cpu)" : "var(--color-gpu)";
  const gaugeAccent = overrides?.gaugeAccent ?? roleAccent;
  const level = overrides?.tempLevel ?? levelForTempC(tempC, tick, component);
  const tempDisplay = formatTemp(tempC, units);
  const tempColor = textColorToken(level);
  const barAccentShell: CSSProperties | undefined = isCpu
    ? undefined
    : { ["--color-accent" as string]: "var(--color-gpu)" };

  const tempValue: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: "var(--font-weight-bold)",
    fontSize: 28,
    lineHeight: "30px",
    letterSpacing: "-0.03em",
    color: tempColor,
  };

  const tempUnit: CSSProperties = {
    fontSize: 14,
    color: "var(--color-muted)",
  };

  return (
    <div
      style={columnShell}
      data-testid={`compact-column-${component}`}
      data-temp-level={level}
    >
      <div style={topRow}>
        <ArcGauge loadPct={loadPct} size={GAUGE_COMPACT} accent={gaugeAccent} />
        <div style={textCol}>
          <div style={labelStyle(roleAccent)}>{isCpu ? "CPU" : "GPU"}</div>
          <div style={tempValue} data-testid={`${component}-temp`}>
            {tempDisplay}
            <span style={tempUnit}>{unitSuffix(units)}</span>
          </div>
          <div style={modelStyle}>{stripModelName(modelName)}</div>
        </div>
      </div>
      <div style={barAccentShell}>
        <TempBar width={140} tempC={tempC} level={level} />
      </div>
    </div>
  );
}
