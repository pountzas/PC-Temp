import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const basePath = join(dirname(fileURLToPath(import.meta.url)), "base.css");

describe("base.css", () => {
  const css = readFileSync(basePath, "utf8");

  it("keeps the page transparent with no root radius or border", () => {
    expect(css).toMatch(/html\s*,\s*body/);
    expect(css).toMatch(/background:\s*transparent/);
    expect(css).not.toMatch(/border-radius/);
    expect(css).not.toMatch(/border\s*:/);
  });

  it("disables selection and page scroll", () => {
    expect(css).toMatch(/user-select:\s*none/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });
});