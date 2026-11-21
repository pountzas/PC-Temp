export function formatVramGiB(
  usedMiB: number | null,
  totalMiB: number | null,
): string {
  if (usedMiB === null || totalMiB === null) {
    return "—";
  }
  const used = (usedMiB / 1024).toFixed(1);
  const total = (totalMiB / 1024).toFixed(1);
  return `${used} / ${total} GB`;
}

export function vramFillRatio(
  usedMiB: number | null,
  totalMiB: number | null,
): number | null {
  if (usedMiB === null || totalMiB === null || totalMiB <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, usedMiB / totalMiB));
}
