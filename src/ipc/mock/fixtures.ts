import compact from "../fixtures/compact.json";
import expanded from "../fixtures/expanded.json";
import hot from "../fixtures/hot.json";
import noNvml from "../fixtures/no-nvml.json";
import noPawnio from "../fixtures/no-pawnio.json";
import warn from "../fixtures/warn.json";
import type { SensorTick } from "../types";

export const FIXTURES = {
  compact: compact as SensorTick,
  expanded: expanded as SensorTick,
  warn: warn as SensorTick,
  hot: hot as SensorTick,
  "no-nvml": noNvml as SensorTick,
  "no-pawnio": noPawnio as SensorTick,
} as const;

export type FixtureName = keyof typeof FIXTURES;