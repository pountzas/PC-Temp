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

/** Path data from docs/spec/gen.py ICON (token colours applied in components). */
const GEN_ICON = {
  gearSpokes:
    "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z",
  close: "M6 6l12 12M18 6L6 18",
} as const;

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
    expect(gear).toContain(`d="${GEN_ICON.gearSpokes}"`);

    const expand = renderToStaticMarkup(<IconExpand />);
    expect(expand).toContain('d="M14 4h6v6M10 20H4v-6"');

    const collapse = renderToStaticMarkup(<IconCollapse />);
    expect(collapse).toContain('d="M4 14h6v6M20 10h-6V4"');

    const pinActive = renderToStaticMarkup(<IconPin active />);
    expect(pinActive).toContain('stroke="var(--color-cpu)"');
    expect(pinActive).toContain(`d="${GEN_ICON.pin}"`);

    const pinIdle = renderToStaticMarkup(<IconPin active={false} />);
    expect(pinIdle).toContain('stroke="var(--color-muted)"');
    expect(pinIdle).toContain(`d="${GEN_ICON.pin}"`);

    const close = renderToStaticMarkup(<IconClose />);
    expect(close).toContain('width="12"');
    expect(close).toContain('stroke-width="2.2"');
    expect(close).toContain(`d="${GEN_ICON.close}"`);
  });
});