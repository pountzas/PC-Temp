import type { SensorTick } from "../../ipc/types";

export interface ExpandedViewProps {
  tick: SensorTick | null;
}

export function ExpandedView({ tick }: ExpandedViewProps) {
  return (
    <section data-view="expanded" data-stub="true">
      <p>Expanded view stub</p>
      <pre>{tick ? JSON.stringify(tick.gpu.vramUsedMiB) : "—"}</pre>
    </section>
  );
}