import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hotCssPath = join(dirname(fileURLToPath(import.meta.url)), "hot.css");

describe("hot.css", () => {
  const css = readFileSync(hotCssPath, "utf8");

  it("applies inner red edge on is-hot panel", () => {
    expect(css).toMatch(
      /\.compact-panel\.is-hot[\s\S]*inset\s+0\s+0\s+0\s+1px\s+rgba\(255,\s*59,\s*78,\s*0\.55\)/,
    );
  });

  it("draws 2px hot top bar inside the panel", () => {
    expect(css).toMatch(
      /\.compact-panel\.is-hot::before[\s\S]*height:\s*2px[\s\S]*var\(--color-hot\)/s,
    );
  });

  it("does not add outer glow blob", () => {
    expect(css).not.toMatch(/filter:\s*blur/);
    const withoutInset = css.replace(/inset[^;]+;/g, "");
    expect(withoutInset).not.toMatch(
      /box-shadow:\s*0\s+0\s+\d+px\s+rgba\(255,\s*59,\s*78/,
    );
  });

  it("keeps hot marks full strength when unfocused", () => {
    expect(css).toMatch(/html\.is-unfocused\s+\.compact-panel\.is-hot/);
    expect(css).not.toMatch(
      /html\.is-unfocused[\s\S]*\.gpu-hot-chip[\s\S]*opacity\s*:/s,
    );
    expect(css).not.toMatch(
      /html\.is-unfocused[\s\S]*\.gpu-hot-chip[\s\S]*filter\s*:/s,
    );
  });

  it("applies inactive border when unfocused and hot", () => {
    expect(css).toMatch(
      /html\.is-unfocused\s+\.compact-panel\.is-hot[\s\S]*var\(--color-window-border-inactive\)/s,
    );
  });
});
