import { useEffect } from "react";

export function useFocusClass(): void {
  useEffect(() => {
    document.documentElement.dataset.focused = "true";
  }, []);
}
