import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ownedPaths = [
  "src/styles/fonts.css",
  "src/styles/base.css",
  "src/components/icons.tsx",
];

describe("HW-03 owned files", () => {
  it("does not use raw hex or rgba outside tokens.css", () => {
    const colourLiteral = /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]+\)/;
    for (const rel of ownedPaths) {
      const text = readFileSync(join(root, rel), "utf8");
      expect(text, rel).not.toMatch(colourLiteral);
    }
  });
});