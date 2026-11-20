import type { Settings } from "../../ipc/types";

export interface SettingsViewProps {
  settings: Settings;
}

export function SettingsView({ settings }: SettingsViewProps) {
  return (
    <section data-view="settings" data-stub="true">
      <p>Settings view stub</p>
      <pre>{JSON.stringify(settings.view)}</pre>
    </section>
  );
}