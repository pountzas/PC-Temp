import { describe, expect, it } from "vitest";
import type { CpuSnapshot } from "../../ipc/types";
import expanded from "../../ipc/fixtures/expanded.json";
import { formatCoreThreadLabel } from "./formatCoreThread";

describe("formatCoreThreadLabel", () => {
  it("uses cores and threads length from fixture", () => {
    const cpu = (expanded as { cpu: CpuSnapshot }).cpu;
    expect(formatCoreThreadLabel(cpu)).toBe("4C/8T");
  });
});
