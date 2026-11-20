import type { SensorTick } from "../types";
import { FIXTURES } from "./fixtures";

export type SensorListener = (tick: SensorTick) => void;

export function startMockSensorEmitter(
  listener: SensorListener,
  intervalMs = 1000,
): () => void {
  let index = 0;
  const names = Object.keys(FIXTURES) as Array<keyof typeof FIXTURES>;
  const emit = () => {
    const name = names[index % names.length];
    const fixture = FIXTURES[name];
    listener({
      ...fixture,
      ts: Date.now(),
      intervalMs: intervalMs as SensorTick["intervalMs"],
    });
    index += 1;
  };

  emit();
  const handle = window.setInterval(emit, intervalMs);
  return () => window.clearInterval(handle);
}