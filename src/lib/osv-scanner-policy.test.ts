import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EXPECTED_IDS = [
  "RUSTSEC-2026-0543",
  "RUSTSEC-2024-0429",
  "GHSA-wrw7-89jp-8q8g",
  "RUSTSEC-2024-0370",
] as const;

const CONFIG_PATH = "src-tauri/osv-scanner.toml";

const ID_LINE = /^\s*id\s*=\s*"([^"]+)"/m;
const REASON_LINE = /reason\s*=\s*"([^"]+)"/;

function parseIgnoredVulnIds(raw: string): string[] {
  const ids: string[] = [];
  for (const block of raw.split("[[IgnoredVulns]]").slice(1)) {
    const match = ID_LINE.exec(block);
    if (match) ids.push(match[1]);
  }
  return ids;
}

function parseIgnoredVulnBlocks(raw: string): string[] {
  return raw.split("[[IgnoredVulns]]").slice(1);
}

describe("osv-scanner.toml (#63)", () => {
  const raw = readFileSync(resolve(process.cwd(), CONFIG_PATH), "utf8");

  it("exists beside src-tauri/Cargo.lock", () => {
    expect(raw.length).toBeGreaterThan(0);
  });

  it("lists only the intended OSV advisory IDs", () => {
    const ids = parseIgnoredVulnIds(raw);
    expect(ids).toEqual([...EXPECTED_IDS]);
  });

  it.each(EXPECTED_IDS)("entry %s has ignoreUntil and reason", (id) => {
    const block = parseIgnoredVulnBlocks(raw).find((b) =>
      b.includes(`id = "${id}"`),
    );
    expect(block, `missing [[IgnoredVulns]] for ${id}`).toBeDefined();
    expect(block).toMatch(/ignoreUntil\s*=\s*2027-02-26/);
    expect(block).toMatch(/reason\s*=\s*"/);
    const reason = block ? REASON_LINE.exec(block)?.[1] : undefined;
    expect(reason?.length).toBeGreaterThan(20);
  });
});