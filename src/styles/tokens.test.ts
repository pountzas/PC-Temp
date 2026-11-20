import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "tokens.css",
);

function parseCustomProperties(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

describe("tokens.css", () => {
  const css = readFileSync(tokensPath, "utf8");
  const tokens = parseCustomProperties(css);

  it("scopes all colour literals to :root custom properties", () => {
    expect(css).toMatch(/:root\s*\{/);
  });

  const colourPairs: [string, string][] = [
    ["--color-bg", "#05070C"],
    ["--color-text", "#EAF2F8"],
    ["--color-muted", "#93A3B5"],
    ["--color-faint", "#56637A"],
    ["--color-cpu", "#22E5FF"],
    ["--color-gpu", "#B65CFF"],
    ["--color-warm", "#FFB020"],
    ["--color-hot", "#FF3B4E"],
    ["--color-line", "rgba(255,255,255,0.09)"],
    ["--color-live", "#3DFFA8"],
    ["--color-hot-text", "#FF6B7A"],
    ["--color-track", "rgba(255,255,255,0.08)"],
    ["--color-divider", "rgba(255,255,255,0.06)"],
    ["--color-accent-bg", "rgba(34,229,255,0.12)"],
    ["--color-window-border", "rgba(255,255,255,0.10)"],
    ["--color-mica-inactive", "#1D1F25"],
    [
      "--color-window-border-inactive",
      "rgba(255,255,255,0.16)",
    ],
    ["--color-accent", "var(--color-cpu)"],
    ["--radius-window", "8px"],
    ["--radius-control", "4px"],
  ];

  it.each(colourPairs)("defines %s as %s", (name, value) => {
    expect(tokens.get(name)).toBe(value);
  });

  it.each([
    ["--font-10", "10px"],
    ["--font-12", "12px"],
    ["--font-14", "14px"],
    ["--font-20", "20px"],
    ["--font-30", "30px"],
    ["--radius-4", "4px"],
    ["--radius-8", "8px"],
    ["--radius-14", "14px"],
    ["--radius-999", "999px"],
    ["--space-4", "4px"],
    ["--space-8", "8px"],
    ["--space-12", "12px"],
    ["--space-16", "16px"],
    ["--space-20", "20px"],
    ["--space-24", "24px"],
    ["--width-pill", "220px"],
    ["--width-compact", "320px"],
    ["--width-expanded", "420px"],
  ])("defines scale token %s", (name, value) => {
    expect(tokens.get(name)).toBe(value);
  });
});