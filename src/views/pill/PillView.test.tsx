import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SensorTick } from "../../ipc/types";
import { PillView } from "./PillView";

const compact = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../ipc/fixtures/compact.json",
    ),
    "utf8",
  ),
) as SensorTick;

vi.mock("../../ipc/useSettings", () => ({
  useSettings: () => ({ units: "C" as const }),
}));

vi.mock("../../window/drag", () => ({
  startDrag: vi.fn(),
}));

describe("PillView", () => {
  it("renders compact.json samples without stub marker", () => {
    const html = renderToStaticMarkup(<PillView tick={compact} />);
    expect(html).toContain("52°");
    expect(html).toContain("64°");
    expect(html).not.toContain("data-stub");
    expect(html).toContain('data-view="pill"');
  });

  it("exposes grip drag handle", () => {
    const html = renderToStaticMarkup(<PillView tick={compact} />);
    expect(html).toContain('data-testid="pill-grip"');
  });
});
