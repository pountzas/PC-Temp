import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GAUGE_COMPACT,
  GAUGE_EXPANDED,
  gaugeValueEndDeg,
} from "../lib/gaugeGeometry";
import { ArcGauge } from "./ArcGauge";

describe("ArcGauge", () => {
  it("renders null load as em dash without value arc strokes", () => {
    const html = renderToStaticMarkup(
      <ArcGauge loadPct={null} size={GAUGE_COMPACT} />,
    );
    expect(html).toContain("—");
    expect(html).not.toContain('stroke-width="10"');
    expect(html).not.toContain("%</span>");
  });

  it("renders Compact 34% with gen.py sweep endpoint", () => {
    const end = gaugeValueEndDeg(34, GAUGE_COMPACT);
    const html = renderToStaticMarkup(
      <ArcGauge loadPct={34} size={GAUGE_COMPACT} />,
    );
    expect(html).toContain(">34<span");
    expect(html).toContain("font-size:9px");
    expect(html).toContain(`stroke-width="${GAUGE_COMPACT.strokeWidth + 5}"`);
    expect(end).toBeCloseTo(226.8, 1);
  });

  it("uses Expanded size tokens", () => {
    const html = renderToStaticMarkup(
      <ArcGauge loadPct={58} size={GAUGE_EXPANDED} accent="var(--color-gpu)" />,
    );
    expect(html).toContain('width="84"');
    expect(html).toContain('stroke-width="6"');
    expect(html).toContain(">58<span");
    expect(html).toContain("font-size:12px");
  });
});
