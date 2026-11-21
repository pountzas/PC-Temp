import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PillPart } from "./PillPart";

describe("PillPart", () => {
  it("renders compact sample CPU with gen.py bar width", () => {
    const html = renderToStaticMarkup(
      <PillPart
        label="CPU"
        accentVar="--color-cpu"
        tempC={52}
        loadPct={34}
        units="C"
      />,
    );
    expect(html).toContain("52°");
    expect(html).toContain("width:10px");
    expect(html).toContain("var(--color-cpu)");
    expect(html).toContain("var(--color-text)");
  });

  it("null temp shows em dash without degree", () => {
    const html = renderToStaticMarkup(
      <PillPart
        label="GPU"
        accentVar="--color-gpu"
        tempC={null}
        loadPct={null}
        units="C"
      />,
    );
    expect(html).toContain("—");
    expect(html).not.toMatch(/—°/);
    expect(html).not.toContain('data-testid="pill-load-fill"');
  });

  it("uses ° suffix without C/F unit text in Fahrenheit mode", () => {
    const html = renderToStaticMarkup(
      <PillPart
        label="CPU"
        accentVar="--color-cpu"
        tempC={52}
        loadPct={34}
        units="F"
      />,
    );
    expect(html).toContain("126°");
    expect(html).not.toContain("°F");
    expect(html).not.toContain("°C");
  });

  it("uses load for bar width, not temperature", () => {
    const html = renderToStaticMarkup(
      <PillPart
        label="GPU"
        accentVar="--color-gpu"
        tempC={90}
        loadPct={58}
        units="C"
      />,
    );
    expect(html).toContain("width:17px");
  });
});
