/** Pill load bar track width — spec §2.3 / docs/spec/gen.py `pillpart`. */
export const PILL_LOAD_BAR_TRACK_PX = 30;

export function pillLoadBarFillPx(loadPct: number | null): number {
  if (loadPct === null) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(100, loadPct));
  return Math.round((PILL_LOAD_BAR_TRACK_PX * clamped) / 100);
}
