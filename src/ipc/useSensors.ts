"use client";

import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { getSnapshot } from "./commands";
import { SENSORS } from "./events";
import { startMockSensorEmitter } from "./mock/emitter";
import type { SensorTick } from "./types";
import { parseSensorTick } from "./types";
import { isTauri, mockSensorsEnabled } from "./tauri";
import { useSettings } from "./useSettings";

export function useSensors(): SensorTick | null {
  const settings = useSettings();
  const [tick, setTick] = useState<SensorTick | null>(null);

  useEffect(() => {
    let active = true;

    if (!isTauri() || mockSensorsEnabled()) {
      const stop = startMockSensorEmitter(
        (next) => {
          if (active) {
            setTick(next);
            if (import.meta.env.DEV) {
              console.info("[mock:sensors]", next.intervalMs, "ms tick");
            }
          }
        },
        settings.intervalMs,
      );
      return () => {
        active = false;
        stop();
      };
    }

    void (async () => {
      const snapshot = await getSnapshot();
      if (active && snapshot) {
        setTick((prev) =>
          prev && prev.ts >= snapshot.ts ? prev : snapshot,
        );
      }
    })();

    const unlisten = listen<unknown>(SENSORS, (event) => {
      if (active) {
        setTick(parseSensorTick(event.payload));
      }
    });

    return () => {
      active = false;
      void unlisten.then((fn) => fn());
    };
  }, [settings.intervalMs]);

  return tick;
}