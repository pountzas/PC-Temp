import type { Settings } from "./types";

export function defaultSettings(): Settings {
  return {
    version: 1,
    opacityPct: 72,
    clickThrough: false,
    alwaysOnTop: true,
    units: "C",
    intervalMs: 1000,
    startWithWindows: true,
    accent: "#22E5FF",
    view: "compact",
    lastUndockedView: "compact",
    position: null,
  };
}