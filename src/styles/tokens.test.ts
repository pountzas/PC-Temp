import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = join(dirname(fileURLToPath(import.meta.url)), "tokens.css");

function parseCustomProperties(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

/** Compare token values after Prettier/normalization (hex case, rgba spacing). */
function normalizeCSSValue(value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (compact.startsWith("#")) {
    return compact.toLowerCase();
  }
  const rgbaMatch = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(compact);
  if (rgbaMatch) {
    const alpha = String(Number(rgbaMatch[4]));
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }
  return compact;
}

describe("tokens.css", () => {
  const css = readFileSync(tokensPath, "utf8");
  const tokens = parseCustomProperties(css);

  it("scopes custom properties on :root", () => {
    expect(css).toMatch(/:root\s*\{/);
  });

  const specPairs: [string, string][] = [
    ["--color-bg", "#05070C"],
    ["--color-glass", "rgba(12,17,26,0.64)"],
    ["--color-glass-raised", "rgba(255,255,255,0.05)"],
    ["--color-line", "rgba(255,255,255,0.09)"],
    ["--color-edge", "rgba(120,225,255,0.35)"],
    ["--color-text", "#EAF2F8"],
    ["--color-muted", "#93A3B5"],
    ["--color-faint", "#56637A"],
    ["--color-cpu", "#22E5FF"],
    ["--color-gpu", "#B65CFF"],
    ["--color-warm", "#FFB020"],
    ["--color-hot", "#FF3B4E"],
    ["--color-mica-inactive", "#1D1F25"],
    ["--color-window-border-inactive", "rgba(255,255,255,0.16)"],
    ["--font-mono", '"JetBrains Mono"'],
    ["--font-display", '"Rajdhani"'],
    ["--font-sans", '"Inter"'],
    ["--text-xs", "10px"],
    ["--text-sm", "12px"],
    ["--text-md", "14px"],
    ["--text-lg", "20px"],
    ["--text-xl", "30px"],
    ["--font-weight-regular", "400"],
    ["--font-weight-semibold", "600"],
    ["--font-weight-bold", "700"],
    ["--tracking-tight", "-0.02em"],
    ["--tracking-caps", "0.14em"],
    ["--opacity-muted", "40%"],
    ["--radius-sm", "4px"],
    ["--radius-md", "8px"],
    ["--radius-lg", "14px"],
    ["--radius-pill", "999px"],
    ["--spacing-1", "4px"],
    ["--spacing-2", "8px"],
    ["--spacing-3", "12px"],
    ["--spacing-4", "16px"],
    ["--spacing-5", "20px"],
    ["--spacing-6", "24px"],
    ["--container-pill", "220px"],
    ["--container-compact", "320px"],
    ["--container-expanded", "420px"],
    ["--breakpoint-desktop", "1280px"],
    ["--color-live", "#3DFFA8"],
    ["--color-hot-text", "#FF6B7A"],
    ["--color-track", "rgba(255,255,255,0.08)"],
    ["--color-divider", "rgba(255,255,255,0.06)"],
    ["--color-accent-bg", "rgba(34,229,255,0.12)"],
    ["--color-window-border", "rgba(255,255,255,0.10)"],
    ["--radius-window", "8px"],
    ["--radius-control", "4px"],
    ["--color-accent", "var(--color-cpu)"],
  ];

  it.each(specPairs)("defines %s as %s", (name, value) => {
    const actual = tokens.get(name);
    expect(actual).toBeDefined();
    expect(normalizeCSSValue(actual ?? "")).toBe(normalizeCSSValue(value));
  });
});
