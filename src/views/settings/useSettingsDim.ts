"use client";

import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { SETTINGS_WINDOW } from "../../ipc/events";
import type { SettingsWindowPayload } from "../../ipc/events";
import type { Settings } from "../../ipc/types";
import { isTauri, mockSensorsEnabled } from "../../ipc/tauri";
import "./settings-dim.css";

const DIMMED_CLASS = "is-settings-dimmed";

function widgetRoot(): HTMLElement {
  return document.getElementById("root") ?? document.documentElement;
}

export function useSettingsDim(settings: Settings): void {
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--panel-bg-alpha",
      String(settings.opacityPct / 100),
    );
    document.documentElement.style.setProperty(
      "--color-accent",
      settings.accent,
    );
  }, [settings.opacityPct, settings.accent]);

  useEffect(() => {
    if (!isTauri() || mockSensorsEnabled()) {
      return;
    }

    const root = widgetRoot();
    const unlistenPromise = listen<SettingsWindowPayload>(
      SETTINGS_WINDOW,
      (event) => {
        root.classList.toggle(DIMMED_CLASS, event.payload.open);
      },
    );

    return () => {
      root.classList.remove(DIMMED_CLASS);
      unlistenPromise
        .then((unlisten) => {
          unlisten();
        })
        .catch(() => {
          // listen failed; nothing to unlisten
        });
    };
  }, []);
}
