import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const backdropPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "settings-backdrop.css",
);

describe("settings-backdrop.css", () => {
  const css = readFileSync(backdropPath, "utf8");

  it("paints the app mica token behind Settings while the window is focused", () => {
    expect(css).toMatch(
      /html:not\(\.is-unfocused\)\s*\{[^}]*background:\s*var\(--color-mica-inactive\)/s,
    );
  });

  it("does not override the unfocused fallback rule", () => {
    expect(css).not.toMatch(/html\.is-unfocused/);
  });
});