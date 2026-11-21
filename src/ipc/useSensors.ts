"use client";

import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { getSnapshot } from "./commands";
import { SENSORS } from "./events";
import { startMockSensorEmitter } from "./mock/emitter";
import type { IntervalMs, SensorTick } from "./types";
import { parseSensorTick } from "./types";
import { isTauri, mockSensorsEnabled } from "./tauri";

export function useSensors(intervalMs: IntervalMs = 1000): SensorTick | null {
  const mockIntervalMs = !isTauri() || mockSensorsEnabled() ? intervalMs : null;
  const [tick, setTick] = useState<SensorTick | null>(null);

  useEffect(() => {
    const lifecycle = { active: true };

    if (mockIntervalMs !== null) {
      const stop = startMockSensorEmitter((next) => {
        if (lifecycle.active) {
          setTick(next);
          if (import.meta.env.DEV) {
            console.info("[mock:sensors]", next.intervalMs, "ms tick");
          }
        }
      }, mockIntervalMs);
      return () => {
        lifecycle.active = false;
        stop();
      };
    }

    void (async () => {
      const snapshot = await getSnapshot();
      if (!lifecycle.active) {
        return;
      }
      if (snapshot !== null) {
        setTick((prev) => (prev && prev.ts >= snapshot.ts ? prev : snapshot));
      }
    })();

    const unlisten = listen<unknown>(SENSORS, (event) => {
      if (lifecycle.active) {
        setTick(parseSensorTick(event.payload));
      }
    });

    return () => {
      lifecycle.active = false;
      void unlisten.then((fn) => {
        fn();
      });
    };
  }, [mockIntervalMs]);

  return tick;
}
