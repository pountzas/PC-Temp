import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(stylesDir, "..", "..");
const fontsCss = join(stylesDir, "fonts.css");
const assetsFonts = join(repoRoot, "src", "assets", "fonts");

const requiredFaces: { family: string; weight: string; file: string }[] = [
  {
    family: "JetBrains Mono",
    weight: "400",
    file: "jetbrains-mono-latin-400-normal.woff2",
  },
  {
    family: "JetBrains Mono",
    weight: "700",
    file: "jetbrains-mono-latin-700-normal.woff2",
  },
  {
    family: "Rajdhani",
    weight: "600",
    file: "rajdhani-latin-600-normal.woff2",
  },
  {
    family: "Rajdhani",
    weight: "700",
    file: "rajdhani-latin-700-normal.woff2",
  },
  { family: "Inter", weight: "400", file: "inter-latin-400-normal.woff2" },
  { family: "Inter", weight: "500", file: "inter-latin-500-normal.woff2" },
];

function faceBlock(css: string, family: string, weight: string): string {
  const re = new RegExp(
    `@font-face\\s*\\{[^}]*font-family:\\s*["']${family}["'][^}]*font-weight:\\s*${weight}[^}]*\\}`,
    "s",
  );
  return css.match(re)?.[0] ?? "";
}

describe("fonts.css", () => {
  const css = readFileSync(fontsCss, "utf8");

  it("uses font-display: block on every @font-face", () => {
    const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    expect(faces.length).toBe(6);
    for (const face of faces) {
      expect(face).toMatch(/font-display:\s*block/);
    }
  });

  it.each(requiredFaces)(
    "declares $family weight $weight with $file",
    ({ family, weight, file }) => {
      const block = faceBlock(css, family, weight);
      expect(block).toContain(`font-family: "${family}"`);
      expect(block).toContain(`font-weight: ${weight}`);
      expect(block).toContain(file);
      expect(existsSync(join(assetsFonts, file))).toBe(true);
    },
  );

  it("includes an OFL licence file per bundled family", () => {
    for (const name of ["jetbrains-mono", "rajdhani", "inter"]) {
      const licensePath = join(assetsFonts, `${name}-OFL.txt`);
      expect(existsSync(licensePath)).toBe(true);
    }
  });
});
