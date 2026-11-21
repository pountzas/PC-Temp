import { describe, expect, it } from "vitest";
import type { CpuSnapshot } from "../../ipc/types";
import expanded from "../../ipc/fixtures/expanded.json";
import { formatCoreThreadLabel } from "./formatCoreThread";

describe("formatCoreThreadLabel", () => {
  it("uses cores and threads length from fixture", () => {
    const cpu = (expanded as { cpu: CpuSnapshot }).cpu;
    expect(formatCoreThreadLabel(cpu)).toBe("4C/8T");
  });

  it("falls back to core count when threads array is empty", () => {
    const cpu: CpuSnapshot = {
      ...(expanded as { cpu: CpuSnapshot }).cpu,
      threads: [],
    };
    expect(formatCoreThreadLabel(cpu)).toBe("4C/4T");
  });
});
