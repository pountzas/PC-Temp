import type { ReactNode } from "react";
import { useState } from "react";
import { Panel } from "../../components/Panel";
import { IconButton } from "../../components/IconButton";
import { closeSettings, updateSettings } from "../../ipc/commands";
import type { AccentColor, IntervalMs, Settings, Units } from "../../ipc/types";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { Swatches } from "./Swatches";
import { Toggle } from "./Toggle";

export type SettingsViewProps = {
  settings: Settings;
};

const labelStyle = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: 13,
  lineHeight: "16px",
  color: "var(--color-text)",
} as const;

const subLabelStyle = {
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  fontSize: 11,
  lineHeight: "14px",
  color: "var(--color-faint)",
} as const;

const rowStyle = (withBorder: boolean) =>
  ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: withBorder ? 40 : 44,
    borderBottom: withBorder ? "1px solid var(--color-divider)" : undefined,
    boxSizing: "border-box",
  }) as const;

const headerTitleStyle = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13,
  lineHeight: "14px",
  letterSpacing: "0.22em",
  color: "var(--color-text)",
} as const;

const INTERVAL_OPTIONS = [
  { value: 1000 as IntervalMs, label: "1s" },
  { value: 2000 as IntervalMs, label: "2s" },
  { value: 5000 as IntervalMs, label: "5s" },
] as const;

type SettingsRowProps = {
  withBorder: boolean;
  label: string;
  subLabel?: string;
  inline?: boolean;
  children: ReactNode;
};

function SettingsRow({
  withBorder,
  label,
  subLabel,
  children,
  inline = false,
}: SettingsRowProps) {
  if (inline) {
    return (
      <div style={rowStyle(false)}>
        <span style={labelStyle}>{label}</span>
        {children}
      </div>
    );
  }

  return (
    <div style={rowStyle(withBorder)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={labelStyle}>{label}</span>
        {subLabel ? <span style={subLabelStyle}>{subLabel}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsView({ settings }: SettingsViewProps) {
  const [pendingAutostart, setPendingAutostart] = useState<boolean | null>(
    null,
  );
  const startWithWindows = pendingAutostart ?? settings.startWithWindows;

  const patch = (partial: Parameters<typeof updateSettings>[0]) => {
    void updateSettings(partial);
  };

  const handleAutostart = async (next: boolean) => {
    setPendingAutostart(next);
    try {
      await updateSettings({ startWithWindows: next });
      setPendingAutostart(null);
    } catch {
      setPendingAutostart(null);
    }
  };

  return (
    <section data-view="settings">
      <Panel
        padding={16}
        style={{
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          borderRadius: "var(--radius-md)",
          ["--panel-bg-alpha" as string]: settings.opacityPct / 100,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 24,
            flexShrink: 0,
          }}
        >
          <span style={headerTitleStyle}>SETTINGS</span>
          <IconButton
            icon="close"
            label="Close settings"
            onClick={() => {
              void closeSettings();
            }}
          />
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 8,
            flex: 1,
          }}
        >
          <div style={rowStyle(true)}>
            <span style={labelStyle}>Opacity</span>
            <Slider
              label="Opacity"
              value={settings.opacityPct}
              onChange={(opacityPct) => {
                patch({ opacityPct });
              }}
            />
          </div>

          <SettingsRow
            withBorder
            label="Click-through"
            subLabel={
              !settings.clickThrough
                ? "Clicks pass through · turn off from tray"
                : undefined
            }
          >
            <Toggle
              label="Click-through"
              checked={settings.clickThrough}
              onChange={(clickThrough) => {
                patch({ clickThrough });
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder label="Always on top">
            <Toggle
              label="Always on top"
              checked={settings.alwaysOnTop}
              onChange={(alwaysOnTop) => {
                patch({ alwaysOnTop });
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder label="Units">
            <Segmented<Units>
              label="Units"
              value={settings.units}
              options={[
                { value: "C", label: "°C" },
                { value: "F", label: "°F" },
              ]}
              onChange={(units) => {
                patch({ units });
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder label="Update interval">
            <Segmented<IntervalMs>
              label="Update interval"
              value={settings.intervalMs}
              options={[...INTERVAL_OPTIONS]}
              onChange={(intervalMs) => {
                patch({ intervalMs });
              }}
            />
          </SettingsRow>

          <SettingsRow
            withBorder
            label="Start with Windows"
            subLabel="Runs at sign-in via Task Scheduler (admin)"
          >
            <Toggle
              label="Start with Windows"
              checked={startWithWindows}
              onChange={(checked) => {
                void handleAutostart(checked);
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder={false} label="Theme accent" inline>
            <Swatches
              value={settings.accent}
              onChange={(accent: AccentColor) => {
                patch({ accent });
              }}
            />
          </SettingsRow>
        </div>
      </Panel>
    </section>
  );
}
