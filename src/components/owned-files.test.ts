import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ownedPaths = [
  "src/components/Panel.tsx",
  "src/components/Header.tsx",
  "src/components/IconButton.tsx",
  "src/components/ArcGauge.tsx",
  "src/components/TempBar.tsx",
  "src/components/Sparkline.tsx",
  "src/components/StatValue.tsx",
  "src/components/PrimitivesDemo.tsx",
  "src/lib/format.ts",
  "src/lib/tempColor.ts",
  "src/lib/gaugeGeometry.ts",
];

/** Allowed literals from issue §2.0 `[no token]` notes (scanlines, sparkline midline). */
const ALLOWED_RAW = [/rgba\(255,255,255,0\.02\)/, /rgba\(255,255,255,0\.07\)/];

describe("HW-12 owned files", () => {
  it("does not use raw hex or rgba outside allowed [no token] literals", () => {
    const colourLiteral = /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]+\)/g;
    for (const rel of ownedPaths) {
      const text = readFileSync(join(root, rel), "utf8");
      const matches = text.match(colourLiteral) ?? [];
      for (const match of matches) {
        const allowed = ALLOWED_RAW.some((re) => re.test(match));
        expect(allowed, `${rel}: ${match}`).toBe(true);
      }
    }
  });
});
