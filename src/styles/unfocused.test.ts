import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const unfocusedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "unfocused.css",
);

describe("unfocused.css", () => {
  const css = readFileSync(unfocusedPath, "utf8");

  it("keeps html transparent when focused", () => {
    expect(css).toMatch(/html\s*\{[^}]*background:\s*transparent/s);
  });

  it("applies solid mica inactive fill when unfocused", () => {
    expect(css).toMatch(
      /html\.is-unfocused\s*\{[^}]*background:\s*var\(--color-mica-inactive\)/s,
    );
    expect(css).not.toMatch(/gradient/);
  });

  it("does not dim data colours or layout", () => {
    expect(css).not.toMatch(/opacity\s*:/);
    expect(css).not.toMatch(/filter\s*:/);
    expect(css).not.toMatch(/border-radius/);
  });
});
