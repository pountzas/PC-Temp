export type Pct = number;
export type Celsius = number;
export type Watts = number;
export type MHz = number;

export type CoreIndex = 0 | 1 | 2 | 3;
export type IntervalMs = 1000 | 2000 | 5000;
export type ViewMode = "compact" | "expanded" | "pill";
export type UndockedView = "compact" | "expanded";
export type AccentColor = "#22E5FF" | "#B65CFF" | "#3DFFA8" | "#FFB020";
export type Units = "C" | "F";
export type AlertComponent = "cpu" | "gpu";
export type AlertLevel = "warm" | "hot";

export type CpuCoreReading = {
  index: CoreIndex;
  tempC: Celsius | null;
  loadPct: Pct | null;
  clockMHz: MHz | null;
};

export type CpuThreadReading = {
  index: number;
  loadPct: Pct | null;
};

export type CpuSnapshot = {
  name: string;
  loadPct: Pct | null;
  packageTempC: Celsius | null;
  packagePowerW: Watts | null;
  clockMHz: MHz | null;
  baseClockMHz: 3500;
  cores: CpuCoreReading[];
  threads?: CpuThreadReading[];
};

export type GpuSnapshot = {
  name: string;
  loadPct: Pct | null;
  coreTempC: Celsius | null;
  coreClockMHz: MHz | null;
  fanPct: Pct | null;
  vramUsedMiB: number | null;
  vramTotalMiB: number | null;
};

export type SensorAlert = {
  component: AlertComponent;
  level: AlertLevel;
  tempC: Celsius;
};

export type SensorHistory = {
  cpuLoad: (Pct | null)[];
  gpuLoad: (Pct | null)[];
};

export type SensorTick = {
  ts: number;
  intervalMs: IntervalMs;
  cpu: CpuSnapshot;
  gpu: GpuSnapshot;
  history: SensorHistory;
  alerts: SensorAlert[];
};

export type Settings = {
  version: 1;
  opacityPct: number;
  clickThrough: boolean;
  alwaysOnTop: boolean;
  units: Units;
  intervalMs: IntervalMs;
  startWithWindows: boolean;
  accent: AccentColor;
  view: ViewMode;
  lastUndockedView: UndockedView;
  position: { x: number; y: number } | null;
};

export type SettingsPatch = Partial<Omit<Settings, "version">>;

export function parseSensorTick(value: unknown): SensorTick {
  return value as SensorTick;
}

export function serializeSensorTick(tick: SensorTick): string {
  return JSON.stringify(tick);
}

export function parseSettings(value: unknown): Settings {
  return value as Settings;
}
