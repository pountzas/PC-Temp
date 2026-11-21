import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExpandedStat } from "./ExpandedStat";

describe("ExpandedStat", () => {
  it("hides unit suffix when value is em dash", () => {
    const html = renderToStaticMarkup(
      <ExpandedStat label="PACKAGE" text="—" unit="°C" />,
    );
    expect(html).toContain("—");
    expect(html).not.toContain("°C");
  });

  it("shows unit when value is present", () => {
    const html = renderToStaticMarkup(
      <ExpandedStat label="PACKAGE" text="52" unit="°C" />,
    );
    expect(html).toContain("°C");
  });
});
