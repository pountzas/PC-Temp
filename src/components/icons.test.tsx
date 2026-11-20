import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  IconClose,
  IconCollapse,
  IconExpand,
  IconGear,
  IconGrip,
  IconPin,
} from "./icons";

describe("icons", () => {
  it("exports six header icons with expected viewBox sizes", () => {
    const grip = renderToStaticMarkup(<IconGrip />);
    expect(grip).toContain('width="10"');
    expect(grip).toContain('height="14"');
    expect(grip).toContain("<circle");
    expect(grip).toContain('fill="var(--color-faint)"');

    const gear = renderToStaticMarkup(<IconGear />);
    expect(gear).toContain('width="14"');
    expect(gear).toContain('viewBox="0 0 24 24"');
    expect(gear).toContain('stroke="var(--color-muted)"');
    expect(gear).toContain('stroke-width="2"');

    const expand = renderToStaticMarkup(<IconExpand />);
    expect(expand).toContain('d="M14 4h6v6M10 20H4v-6"');

    const collapse = renderToStaticMarkup(<IconCollapse />);
    expect(collapse).toContain('d="M4 14h6v6M20 10h-6V4"');

    const pinPaths = {
      stem: "M12 17v5",
      head: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
    };

    const pinActive = renderToStaticMarkup(<IconPin active />);
    expect(pinActive).toContain('stroke="var(--color-cpu)"');
    expect(pinActive).toContain(`d="${pinPaths.stem}"`);
    expect(pinActive).toContain(`d="${pinPaths.head}"`);

    const pinIdle = renderToStaticMarkup(<IconPin active={false} />);
    expect(pinIdle).toContain('stroke="var(--color-muted)"');
    expect(pinIdle).toContain(`d="${pinPaths.stem}"`);
    expect(pinIdle).toContain(`d="${pinPaths.head}"`);

    const close = renderToStaticMarkup(<IconClose />);
    expect(close).toContain('width="12"');
    expect(close).toContain('stroke-width="2.2"');
  });
});