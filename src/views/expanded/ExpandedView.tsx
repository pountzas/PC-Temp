"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SensorTick } from "../../ipc/types";
import { openSettings, updateSettings } from "../../ipc/commands";
import type { Settings } from "../../ipc/types";
import { isTauri, mockSensorsEnabled } from "../../ipc/tauri";
import { setView } from "../../window/view";
import { Header } from "../../components/Header";
import { Panel } from "../../components/Panel";
import { CpuSection } from "./CpuSection";
import { ExpandedFooter } from "./ExpandedFooter";
import { GpuSection } from "./GpuSection";
import { runHeaderAction } from "./headerAction";

export type ExpandedViewProps = {
  tick: SensorTick | null;
  settings: Settings;
};

function hideWidget(): void {
  if (!isTauri() || mockSensorsEnabled()) {
    return;
  }
  void getCurrentWindow().hide();
}

export function ExpandedView({ tick, settings }: ExpandedViewProps) {
  const intervalMs = tick?.intervalMs ?? settings.intervalMs;

  const headerButtons = [
    {
      icon: "gear" as const,
      label: "Settings",
      onClick: () => {
        runHeaderAction(() => openSettings());
      },
    },
    {
      icon: "collapse" as const,
      label: "Collapse",
      onClick: () => {
        runHeaderAction(() => setView("compact"));
      },
    },
    {
      icon: "pin" as const,
      label: "Always on top",
      active: settings.alwaysOnTop,
      onClick: () => {
        runHeaderAction(() =>
          updateSettings({ alwaysOnTop: !settings.alwaysOnTop }),
        );
      },
    },
    { icon: "close" as const, label: "Hide", onClick: hideWidget },
  ];

  const body =
    tick === null ? (
      <p
        style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-faint)",
        }}
      >
        Waiting for sensor data…
      </p>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginTop: 14,
          flex: 1,
          minHeight: 0,
        }}
      >
        <CpuSection tick={tick} units={settings.units} />
        <div
          role="separator"
          style={{ height: 1, background: "var(--color-line)", flexShrink: 0 }}
        />
        <GpuSection tick={tick} units={settings.units} />
      </div>
    );

  return (
    <section
      data-view="expanded"
      style={{
        width: "var(--container-expanded)",
        height: 540,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Panel
        padding={18}
        style={{
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          ["--panel-bg-alpha" as string]: settings.opacityPct / 100,
        }}
      >
        <Header buttons={headerButtons} />
        {body}
        <ExpandedFooter intervalMs={intervalMs} units={settings.units} />
      </Panel>
    </section>
  );
}
