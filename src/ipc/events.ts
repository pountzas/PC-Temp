import type { ViewMode } from "./types";

export const SENSORS = "sensors";
export const SETTINGS_CHANGED = "settings-changed";
export const VIEW_CHANGED = "view-changed";
export const SETTINGS_WINDOW = "settings-window";

export type ViewChangedPayload = {
  view: ViewMode;
};

export type SettingsWindowPayload = {
  open: boolean;
};
