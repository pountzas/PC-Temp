import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TempBar } from "./TempBar";

describe("TempBar", () => {
  it("null renders track only", () => {
    const html = renderToStaticMarkup(
      <TempBar width={100} tempC={null} level="normal" />,
    );
    expect(html).not.toContain('data-testid="temp-bar-fill"');
  });

  it("clamps fill to 0..100 °C", () => {
    expect(
      renderToStaticMarkup(<TempBar width={100} tempC={120} level="hot" />),
    ).toContain("width:100px");
    expect(
      renderToStaticMarkup(<TempBar width={100} tempC={-5} level="normal" />),
    ).toContain("width:0");
  });

  it("uses level fill + glow colour", () => {
    const html = renderToStaticMarkup(
      <TempBar width={100} tempC={88} level="warn" />,
    );
    expect(html).toContain("background:var(--color-warm)");
    expect(html).toContain("0 0 8px var(--color-warm)");
  });
});
