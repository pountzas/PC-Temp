import { useEffect } from "react";

export function useDock(): void {
  useEffect(() => {
    document.documentElement.dataset.docked = "false";
  }, []);
}