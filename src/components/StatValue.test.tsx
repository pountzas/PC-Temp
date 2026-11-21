import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatValue } from "./StatValue";

describe("StatValue", () => {
  it("shows em dash for null, not zero", () => {
    const html = renderToStaticMarkup(
      <StatValue label="POWER" value={null} unit="W" />,
    );
    expect(html).toContain("—");
    expect(html).not.toContain(">0<");
  });
});
