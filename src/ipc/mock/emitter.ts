import type { SensorTick } from "../types";
import { FIXTURES, type FixtureName } from "./fixtures";

export type SensorListener = (tick: SensorTick) => void;

const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];

function pinnedFixtureName(): FixtureName | null {
  const raw = import.meta.env.VITE_MOCK_FIXTURE?.trim();
  if (!raw || raw === "cycle") {
    return null;
  }
  if (raw in FIXTURES) {
    return raw as FixtureName;
  }
  return null;
}

export function startMockSensorEmitter(
  listener: SensorListener,
  intervalMs = 1000,
): () => void {
  const pinned = pinnedFixtureName();
  let index = 0;
  const emit = () => {
    const name = pinned ?? FIXTURE_NAMES[index % FIXTURE_NAMES.length];
    const fixture = FIXTURES[name];
    listener({
      ...fixture,
      ts: Date.now(),
      intervalMs: intervalMs as SensorTick["intervalMs"],
    });
    if (!pinned) {
      index += 1;
    }
  };

  emit();
  const handle = window.setInterval(emit, intervalMs);
  return () => window.clearInterval(handle);
}