import type { AccentColor } from "../../ipc/types";

export const ACCENT_SWATCHES: AccentColor[] = [
  "#22E5FF",
  "#B65CFF",
  "#3DFFA8",
  "#FFB020",
];

export function selectedSwatchRing(color: AccentColor): string {
  return `0 0 0 2px var(--color-bg), 0 0 0 3.5px ${color}, 0 0 10px ${color}`;
}
