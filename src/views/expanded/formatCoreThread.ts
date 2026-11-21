import type { CpuSnapshot } from "../../ipc/types";

export function formatCoreThreadLabel(cpu: CpuSnapshot): string {
  const coreCount = cpu.cores.length;
  const threadCount = cpu.threads?.length ?? coreCount;
  return `${coreCount}C/${threadCount}T`;
}
