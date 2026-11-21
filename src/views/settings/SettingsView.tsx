import type { ReactNode } from "react";
import { useState } from "react";
import { Panel } from "../../components/Panel";
import { IconButton } from "../../components/IconButton";
import { closeSettings, updateSettings } from "../../ipc/commands";
import type { AccentColor, IntervalMs, Settings, Units } from "../../ipc/types";
import { applySettingsPatch } from "./applySettingsPatch";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { Swatches } from "./Swatches";
import { Toggle } from "./Toggle";

export type SettingsViewProps = {
  settings: Settings;
};

const CLICK_THROUGH_SUBLABEL = "Clicks pass through · turn off from tray";

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
  const [autostartBusy, setAutostartBusy] = useState(false);
  const startWithWindows = pendingAutostart ?? settings.startWithWindows;

  const handleAutostart = async (next: boolean) => {
    setAutostartBusy(true);
    setPendingAutostart(next);
    try {
      await updateSettings({ startWithWindows: next });
      setPendingAutostart(null);
    } catch (error) {
      console.warn("Start with Windows toggle failed", error);
      setPendingAutostart(null);
    } finally {
      setAutostartBusy(false);
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
                void applySettingsPatch({ opacityPct });
              }}
            />
          </div>

          <SettingsRow
            withBorder
            label="Click-through"
            subLabel={CLICK_THROUGH_SUBLABEL}
          >
            <Toggle
              label="Click-through"
              checked={settings.clickThrough}
              onChange={(clickThrough) => {
                void applySettingsPatch({ clickThrough });
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder label="Always on top">
            <Toggle
              label="Always on top"
              checked={settings.alwaysOnTop}
              onChange={(alwaysOnTop) => {
                void applySettingsPatch({ alwaysOnTop });
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
                void applySettingsPatch({ units });
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder label="Update interval">
            <Segmented<IntervalMs>
              label="Update interval"
              value={settings.intervalMs}
              options={[...INTERVAL_OPTIONS]}
              onChange={(intervalMs) => {
                void applySettingsPatch({ intervalMs });
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
              disabled={autostartBusy}
              busy={autostartBusy}
              onChange={(checked) => {
                void handleAutostart(checked);
              }}
            />
          </SettingsRow>

          <SettingsRow withBorder={false} label="Theme accent" inline>
            <Swatches
              value={settings.accent}
              onChange={(accent: AccentColor) => {
                void applySettingsPatch({ accent });
              }}
            />
          </SettingsRow>
        </div>
      </Panel>
    </section>
  );
}
