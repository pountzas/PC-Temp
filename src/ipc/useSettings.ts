"use client";

import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { getSettings } from "./commands";
import { SETTINGS_CHANGED } from "./events";
import { defaultSettings } from "./settingsDefaults";
import type { Settings } from "./types";
import { parseSettings } from "./types";
import { isTauri, mockSensorsEnabled } from "./tauri";

export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(defaultSettings());

  useEffect(() => {
    let active = true;
    let receivedEvent = false;

    if (!isTauri() || mockSensorsEnabled()) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      const current = await getSettings();
      if (active && !receivedEvent) {
        setSettings(current);
      }
    })();

    const unlisten = listen<unknown>(SETTINGS_CHANGED, (event) => {
      if (active) {
        receivedEvent = true;
        setSettings(parseSettings(event.payload));
      }
    });

    return () => {
      active = false;
      void unlisten.then((fn) => fn());
    };
  }, []);

  return settings;
}