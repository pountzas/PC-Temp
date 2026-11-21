import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("renders separate polylines when null breaks the series", () => {
    const html = renderToStaticMarkup(
      <Sparkline width={120} height={30} values={[10, null, 30, 40]} />,
    );
    const polylines = html.match(/<polyline/g) ?? [];
    expect(polylines).toHaveLength(2);
  });

  it("omits end dot when the newest sample is null", () => {
    const html = renderToStaticMarkup(
      <Sparkline width={120} height={30} values={[10, 20, null]} />,
    );
    expect(html).not.toContain("<circle");
  });

  it("clamps load to 0..100 for y position", () => {
    const html = renderToStaticMarkup(
      <Sparkline width={100} height={30} values={[150]} />,
    );
    expect(html).toContain('cy="0"');
    expect(html).not.toMatch(/cy="-/);
  });
});
