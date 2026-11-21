import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HotChip } from "./HotChip";

describe("HotChip", () => {
  it("renders GPU HOT label and dot", () => {
    const html = renderToStaticMarkup(<HotChip />);
    expect(html).toContain("GPU HOT");
    expect(html).toContain('data-testid="gpu-hot-chip"');
    expect(html).toContain("gpu-hot-chip__dot");
  });
});
