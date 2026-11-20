import type { SensorTick } from "../../ipc/types";

export interface CompactViewProps {
  tick: SensorTick | null;
}

export function CompactView({ tick }: CompactViewProps) {
  return (
    <section data-view="compact" data-stub="true">
      <p>Compact view stub</p>
      <pre>{tick ? JSON.stringify(tick.cpu.loadPct) : "—"}</pre>
    </section>
  );
}