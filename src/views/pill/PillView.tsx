import type { CSSProperties, MouseEvent } from "react";
import { IconGrip } from "../../components/icons";
import { useSettings } from "../../ipc/useSettings";
import type { SensorTick } from "../../ipc/types";
import { startDrag } from "../../window/drag";
import { PillPart } from "./PillPart";

export type PillViewProps = {
  tick: SensorTick | null;
};

const shell: CSSProperties = {
  boxSizing: "border-box",
  width: "var(--container-pill)",
  height: 44,
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-3)",
  padding: "0 14px 0 12px",
};

const divider: CSSProperties = {
  width: 1,
  height: 20,
  background: "rgba(255, 255, 255, 0.12)",
  flexShrink: 0,
};

function gripProps(onDrag: (e: MouseEvent) => void) {
  return {
    "data-testid": "pill-grip",
    onMouseDown: onDrag,
    style: {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
      cursor: "default",
    } as CSSProperties,
  };
}

export function PillView({ tick }: PillViewProps) {
  const { units } = useSettings();

  const cpuTemp = tick?.cpu.packageTempC ?? null;
  const cpuLoad = tick?.cpu.loadPct ?? null;
  const gpuTemp = tick?.gpu.coreTempC ?? null;
  const gpuLoad = tick?.gpu.loadPct ?? null;

  return (
    <section data-view="pill" style={shell}>
      <div {...gripProps(startDrag)}>
        <IconGrip />
      </div>
      <PillPart
        label="CPU"
        accentVar="--color-cpu"
        tempC={cpuTemp}
        loadPct={cpuLoad}
        units={units}
      />
      <div aria-hidden style={divider} />
      <PillPart
        label="GPU"
        accentVar="--color-gpu"
        tempC={gpuTemp}
        loadPct={gpuLoad}
        units={units}
      />
    </section>
  );
}
