import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const defaultCapsPath = resolve(
  repoRoot,
  "src-tauri/capabilities/default.json",
);
const debugCapsPath = resolve(
  repoRoot,
  "src-tauri/capabilities/mcp-bridge-debug.json",
);
const tauriConfPath = resolve(repoRoot, "src-tauri/tauri.conf.json");
const tauriDebugConfPath = resolve(repoRoot, "src-tauri/tauri.debug.conf.json");
const libRsPath = resolve(repoRoot, "src-tauri/src/lib.rs");
const cargoTomlPath = resolve(repoRoot, "src-tauri/Cargo.toml");

describe("MCP bridge packaging (issue #76)", () => {
  it("keeps mcp-bridge permissions out of release default capabilities", () => {
    const json = JSON.parse(readFileSync(defaultCapsPath, "utf8")) as {
      permissions: string[];
    };
    expect(json.permissions).not.toContain("mcp-bridge:default");
    expect(json.permissions.some((p) => p.startsWith("mcp-bridge:"))).toBe(
      false,
    );
  });

  it("pins release tauri.conf security.capabilities to default only", () => {
    const conf = JSON.parse(readFileSync(tauriConfPath, "utf8")) as {
      app: { security?: { capabilities?: string[] } };
    };
    expect(conf.app.security?.capabilities).toEqual(["default"]);
  });

  it("grants mcp-bridge:default only via the debug capability file", () => {
    const json = JSON.parse(readFileSync(debugCapsPath, "utf8")) as {
      identifier: string;
      windows: string[];
      permissions: string[];
    };
    expect(json.identifier).toBe("mcp-bridge-debug");
    expect(json.windows).toEqual(["widget", "settings"]);
    expect(json.permissions).toEqual(["mcp-bridge:default"]);
  });

  it("enables the mcp-bridge Cargo feature and debug capability via tauri.debug.conf.json", () => {
    const conf = JSON.parse(readFileSync(tauriDebugConfPath, "utf8")) as {
      build?: { features?: string[] };
      app?: { security?: { capabilities?: string[] } };
    };
    expect(conf.build?.features).toContain("mcp-bridge");
    expect(conf.app?.security?.capabilities).toEqual([
      "default",
      "mcp-bridge-debug",
    ]);
  });

  it("registers the plugin only under debug_assertions + mcp-bridge feature on localhost", () => {
    const lib = readFileSync(libRsPath, "utf8");
    expect(lib).toMatch(
      /#\[cfg\(all\(debug_assertions,\s*feature\s*=\s*"mcp-bridge"\)\)\]/,
    );
    expect(lib).toContain('bind_address("127.0.0.1")');
  });

  it("declares tauri-plugin-mcp-bridge as an optional feature-gated dependency", () => {
    const cargo = readFileSync(cargoTomlPath, "utf8");
    expect(cargo).toMatch(
      /tauri-plugin-mcp-bridge\s*=\s*\{[^}]*optional\s*=\s*true/,
    );
    expect(cargo).toMatch(
      /mcp-bridge\s*=\s*\[\s*"dep:tauri-plugin-mcp-bridge"\s*\]/,
    );
  });
});
