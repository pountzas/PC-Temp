import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const settingsDir = dirname(fileURLToPath(import.meta.url));

const ownedFiles = readdirSync(settingsDir).filter(
  (name) =>
    (name.endsWith(".tsx") || name.endsWith(".ts")) &&
    !name.endsWith(".test.tsx") &&
    !name.endsWith(".test.ts"),
);

/** Spec §2.5 hard-coded literals allowed in Settings controls. */
const ALLOWED_RAW = [
  /rgba\(255,255,255,0\.1\)/,
  /rgba\(255,255,255,0\.12\)/,
  /rgba\(255,255,255,0\.06\)/,
  /rgba\(34,229,255,0\.9\)/,
  /rgba\(34,229,255,0\.45\)/,
  /rgba\(34,229,255,0\.3\)/,
  /rgba\(34,229,255,0\.16\)/,
  /#22E5FF/,
  /#B65CFF/,
  /#3DFFA8/,
  /#FFB020/,
];

describe("HW-19 owned settings files", () => {
  it("does not use raw hex or rgba outside allowed §2.5 literals", () => {
    const colourLiteral = /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]+\)/g;
    for (const name of ownedFiles) {
      const text = readFileSync(join(settingsDir, name), "utf8");
      const matches = text.match(colourLiteral) ?? [];
      for (const match of matches) {
        const allowed = ALLOWED_RAW.some((re) => re.test(match));
        expect(allowed, `${name}: ${match}`).toBe(true);
      }
    }
  });
});
