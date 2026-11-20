import type { SensorTick } from "../../ipc/types";

export interface PillViewProps {
  tick: SensorTick | null;
}

export function PillView({ tick }: PillViewProps) {
  return (
    <section data-view="pill" data-stub="true">
      <p>Mini pill stub</p>
      <pre>{tick ? `${tick.cpu.loadPct ?? "—"} / ${tick.gpu.loadPct ?? "—"}` : "—"}</pre>
    </section>
  );
}