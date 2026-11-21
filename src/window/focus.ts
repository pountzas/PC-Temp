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
    let sawFocusEvent = false;
    const unlistenPromise = win.onFocusChanged(({ payload: focused }) => {
      sawFocusEvent = true;
      setUnfocused(!focused);
    });
    unlistenPromise.catch((err: unknown) => {
      console.warn("useFocusClass: onFocusChanged failed", err);
    });

    win
      .isFocused()
      .then((focused) => {
        if (!disposed && !sawFocusEvent) {
          setUnfocused(!focused);
        }
      })
      .catch((err: unknown) => {
        console.warn("useFocusClass: isFocused failed", err);
      });

    return () => {
      disposed = true;
      unlistenPromise
        .then((unlisten) => {
          unlisten();
        })
        .catch(() => {
          // already logged above
        });
      setUnfocused(false);
    };
  }, []);
}
