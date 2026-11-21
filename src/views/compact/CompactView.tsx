import type { CSSProperties } from "react";
import { Header } from "../../components/Header";
import { Panel } from "../../components/Panel";
import type { SensorTick, Settings } from "../../ipc/types";
import { isGpuHot } from "../../lib/hot";
import { CompactColumn } from "./CompactColumn";
import { CompactFooter } from "./CompactFooter";
import {
  expandView,
  hideWidget,
  openSettingsPanel,
  toggleAlwaysOnTop,
} from "./compactHeaderActions";
import { HotChip } from "./hot/HotChip";
import "./hot/hot.css";

export type CompactViewProps = {
  tick: SensorTick | null;
  settings: Settings;
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "var(--container-compact)",
  height: 200,
  boxSizing: "border-box",
};

const bodyRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 14,
  flex: 1,
  minHeight: 0,
};

const emptyCpu = {
  name: "",
  loadPct: null,
  packageTempC: null,
  packagePowerW: null,
  clockMHz: null,
  baseClockMHz: 3500 as const,
  cores: [],
};

const emptyGpu = {
  name: "",
  loadPct: null,
  coreTempC: null,
  coreClockMHz: null,
  fanPct: null,
  vramUsedMiB: null,
  vramTotalMiB: null,
};

export function CompactView({ tick, settings }: CompactViewProps) {
  const cpu = tick?.cpu ?? emptyCpu;
  const gpu = tick?.gpu ?? emptyGpu;
  const gpuHot = isGpuHot(tick);
  const panelClass = gpuHot ? "compact-panel is-hot" : "compact-panel";

  return (
    <section data-view="compact">
      <Panel padding={14} className={panelClass} style={panelStyle}>
        <Header
          chip={gpuHot ? <HotChip /> : undefined}
          buttons={[
            {
              icon: "gear",
              label: "Settings",
              onClick: () => {
                void openSettingsPanel();
              },
            },
            {
              icon: "expand",
              label: "Expand view",
              onClick: () => {
                void expandView();
              },
            },
            {
              icon: "pin",
              label: "Always on top",
              active: settings.alwaysOnTop,
              onClick: () => {
                void toggleAlwaysOnTop(settings.alwaysOnTop);
              },
            },
            {
              icon: "close",
              label: "Hide widget",
              onClick: hideWidget,
            },
          ]}
        />
        <div style={bodyRow}>
          <CompactColumn
            component="cpu"
            loadPct={cpu.loadPct}
            tempC={cpu.packageTempC}
            modelName={cpu.name}
            units={settings.units}
            tick={tick}
          />
          <CompactColumn
            component="gpu"
            loadPct={gpu.loadPct}
            tempC={gpu.coreTempC}
            modelName={gpu.name}
            units={settings.units}
            tick={tick}
            overrides={gpuHot ? { gaugeAccent: "var(--color-hot)" } : undefined}
          />
        </div>
        <CompactFooter
          tick={tick}
          intervalMs={settings.intervalMs}
          gpuHot={gpuHot}
        />
      </Panel>
    </section>
  );
}
