import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrimitivesDemo } from "./PrimitivesDemo";

describe("PrimitivesDemo", () => {
  it("renders showcase markup", () => {
    const html = renderToStaticMarkup(<PrimitivesDemo />);
    expect(html).toContain('data-testid="primitives-demo"');
    expect(html).toContain('data-testid="arc-gauge"');
    expect(html).toContain('data-testid="temp-bar"');
    expect(html).toContain('data-testid="sparkline"');
  });
});
