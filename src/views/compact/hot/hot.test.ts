import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hotCssPath = join(dirname(fileURLToPath(import.meta.url)), "hot.css");

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ruleRe = new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "s");
  const match = ruleRe.exec(css);
  if (!match) {
    throw new Error(`rule not found: ${selector}`);
  }
  return match[1];
}

describe("hot.css", () => {
  const css = readFileSync(hotCssPath, "utf8");

  it("applies inner red edge on is-hot ::after overlay", () => {
    const body = ruleBody(css, ".compact-panel.is-hot::after");
    expect(body).toMatch(/z-index:\s*2/);
    expect(body).toMatch(
      /inset\s+0\s+0\s+0\s+1px\s+rgba\(255,\s*59,\s*78,\s*0\.55\)/,
    );
  });

  it("draws 2px hot top bar inside the panel", () => {
    const body = ruleBody(css, ".compact-panel.is-hot::before");
    expect(body).toMatch(/height:\s*2px/);
    expect(body).toMatch(/var\(--color-hot\)/);
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

  it("applies inactive border as inset shadow on ::after when unfocused", () => {
    const body = ruleBody(
      css,
      "html.is-unfocused .compact-panel.is-hot::after",
    );
    expect(body).toMatch(/box-shadow/);
    expect(body).toMatch(/var\(--color-window-border-inactive\)/);
    expect(css).not.toMatch(
      /html\.is-unfocused\s+\.compact-panel\.is-hot\s*\{[^}]*border\s*:/s,
    );
  });
});
