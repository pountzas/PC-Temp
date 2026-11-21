import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("applies panel background opacity via CSS var on the bg layer only", () => {
    const html = renderToStaticMarkup(
      <Panel padding={14} style={{ ["--panel-bg-alpha" as string]: 0.5 }}>
        <span data-testid="content">data</span>
      </Panel>,
    );
    expect(html).toContain("--panel-bg-alpha");
    expect(html).toContain("var(--color-mica-inactive)");
    expect(html).toContain("repeating-linear-gradient");
    expect(html).toContain(">data<");
    expect(html).not.toContain("opacity:0.5");
  });
});
