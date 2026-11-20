export const SENSORS = "sensors";
export const SETTINGS_CHANGED = "settings-changed";
export const VIEW_CHANGED = "view-changed";
export const SETTINGS_WINDOW = "settings-window";

export interface ViewChangedPayload {
  view: string;
}

export interface SettingsWindowPayload {
  open: boolean;
}