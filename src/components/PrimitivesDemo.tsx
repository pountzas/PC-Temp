import compactRef from "../../docs/design/01-compact.png";
import expandedRef from "../../docs/design/02-expanded.png";
import { GAUGE_COMPACT, GAUGE_EXPANDED } from "../lib/gaugeGeometry";
import { levelForTempC } from "../lib/tempColor";
import { ArcGauge } from "./ArcGauge";
import { Header } from "./Header";
import { Panel } from "./Panel";
import { Sparkline } from "./Sparkline";
import { StatValue } from "./StatValue";
import { TempBar } from "./TempBar";

const page = {
  minHeight: "100vh",
  padding: 24,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-sans)",
  overflow: "auto",
} as const;

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  alignItems: "start",
} as const;

const caption = {
  fontSize: 11,
  color: "var(--color-muted)",
  marginBottom: 8,
} as const;

const refImg = {
  width: "100%",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-line)",
} as const;

const samples = [34, 58, null] as const;
const spark = [12, 18, 22, 30, 28, 34, 40, 38, 36, 34];

export function PrimitivesDemo() {
  return (
    <main style={page} data-testid="primitives-demo">
      <h1 style={{ fontSize: 16, marginBottom: 16 }}>HW-12 primitives</h1>
      <Panel padding={18} style={{ ["--panel-bg-alpha" as string]: 0.72 }}>
        <Header
          buttons={[
            { icon: "gear", label: "Settings" },
            { icon: "expand", label: "Expand" },
            { icon: "pin", label: "Pin", active: true },
            { icon: "close", label: "Close" },
          ]}
        />
        <div
          style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}
        >
          <ArcGauge loadPct={34} size={GAUGE_COMPACT} />
          <ArcGauge
            loadPct={58}
            size={GAUGE_EXPANDED}
            accent="var(--color-gpu)"
          />
          <ArcGauge loadPct={null} size={GAUGE_COMPACT} />
          <TempBar width={140} tempC={52} level="normal" />
          <TempBar
            width={140}
            tempC={88}
            level={levelForTempC(88, null, "cpu")}
          />
          <TempBar width={140} tempC={null} level="normal" />
          <StatValue label="PACKAGE" value={52} unit="°C" />
          <StatValue label="POWER" value={null} unit="W" />
          <Sparkline width={200} values={spark} />
        </div>
      </Panel>

      <section style={{ marginTop: 32 }}>
        <p style={caption}>Visual reference (Paper crops)</p>
        <div style={row}>
          <img src={compactRef} alt="Compact reference" style={refImg} />
          <img src={expandedRef} alt="Expanded reference" style={refImg} />
        </div>
      </section>

      <section style={{ marginTop: 24, display: "flex", gap: 16 }}>
        {samples.map((load) => (
          <ArcGauge key={String(load)} loadPct={load} size={GAUGE_COMPACT} />
        ))}
      </section>
    </main>
  );
}
