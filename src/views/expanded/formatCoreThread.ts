import type { CpuSnapshot } from "../../ipc/types";

export function formatCoreThreadLabel(cpu: CpuSnapshot): string {
  const coreCount = cpu.cores.length;
  const threadsLen = cpu.threads?.length;
  const threadCount =
    threadsLen === undefined || threadsLen === 0 ? coreCount : threadsLen;
  return `${coreCount}C/${threadCount}T`;
}
