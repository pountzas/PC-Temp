import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { isTauri, mockSensorsEnabled } from "../ipc/tauri";

const UNFOCUSED_CLASS = "is-unfocused";

function setUnfocused(unfocused: boolean): void {
  document.documentElement.classList.toggle(UNFOCUSED_CLASS, unfocused);
}

export function useFocusClass(): void {
  useEffect(() => {
    if (!isTauri() || mockSensorsEnabled()) {
      const onBlur = () => {
        setUnfocused(true);
      };
      const onFocus = () => {
        setUnfocused(false);
      };
      window.addEventListener("blur", onBlur);
      window.addEventListener("focus", onFocus);
      setUnfocused(!document.hasFocus());
      return () => {
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("focus", onFocus);
        setUnfocused(false);
      };
    }

    const win = getCurrentWindow();
    let disposed = false;
    const unlistenPromise = win.onFocusChanged(({ payload: focused }) => {
      setUnfocused(!focused);
    });

    void win.isFocused().then((focused) => {
      if (!disposed) {
        setUnfocused(!focused);
      }
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => {
        unlisten();
      });
      setUnfocused(false);
    };
  }, []);
}
