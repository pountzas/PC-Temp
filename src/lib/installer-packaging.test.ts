import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Windows installer packaging (#21)", () => {
  const conf = JSON.parse(read("src-tauri/tauri.conf.json")) as {
    build: { beforeBuildCommand: string };
    bundle: {
      targets: string | string[];
      externalBin?: string[];
      resources?: string[] | Record<string, string>;
      windows?: { nsis?: { installerHooks?: string } };
    };
  };

  it("bundles the LHM sidecar and builds it before the Tauri bundle", () => {
    expect(conf.bundle.externalBin).toEqual(["binaries/lhm-reader"]);
    expect(conf.build.beforeBuildCommand).toMatch(/build-sidecar\.ps1/);
  });

  it("targets NSIS and wires installer hooks", () => {
    const targets = conf.bundle.targets;
    expect(
      targets === "nsis" ||
        (Array.isArray(targets) && targets.includes("nsis")),
    ).toBe(true);
    expect(conf.bundle.windows?.nsis?.installerHooks).toBe(
      "./windows/hooks.nsh",
    );
  });

  it("ships install-pawnio.ps1 as a bundle resource (not embedded PawnIO)", () => {
    expect(existsSync("scripts/install-pawnio.ps1")).toBe(true);
    const resources = conf.bundle.resources;
    const paths = Array.isArray(resources)
      ? resources
      : resources
        ? [...Object.keys(resources), ...Object.values(resources)]
        : [];
    expect(
      paths.some((p) => p.replace(/\\/g, "/").includes("install-pawnio.ps1")),
    ).toBe(true);
    const ps1 = read("scripts/install-pawnio.ps1");
    expect(ps1).not.toMatch(/WinRing0/i);
  });

  it("install-pawnio uses the official 2.2.0 URL and verified silent flags", () => {
    const ps1 = read("scripts/install-pawnio.ps1");
    expect(ps1).toContain("namazso/PawnIO.Setup/releases/download");
    expect(ps1).toContain("PAWNIO_VERSION = '2.2.0'");
    expect(ps1).toContain("PawnIO_setup.exe");
    expect(ps1).toMatch(/-install/);
    expect(ps1).toMatch(/-silent/);
    expect(ps1).toMatch(/Get-AuthenticodeSignature/);
    expect(ps1).toMatch(/3010/);
  });

  it("NSIS hooks run PawnIO step and remove the PC-Temp scheduled task on uninstall", () => {
    const hooks = read("src-tauri/windows/hooks.nsh");
    expect(hooks).toMatch(/NSIS_HOOK_POSTINSTALL/);
    expect(hooks).toMatch(/install-pawnio\.ps1/i);
    expect(hooks).toMatch(/NSIS_HOOK_POSTUNINSTALL/);
    expect(hooks).toMatch(/schtasks.*PC-Temp/i);
  });

  it("release workflow is manual dispatch with SHA-pinned actions", () => {
    const yml = read(".github/workflows/release.yml");
    expect(yml).toMatch(/workflow_dispatch/);
    expect(yml).toMatch(/uses:\s+\S+@\S+\s+#/);
    expect(yml).toMatch(/WinRing0/i);
    expect(yml).toMatch(/PawnIO/i);
  });

  it("installed app requests administrator elevation", () => {
    const manifest = read("src-tauri/manifest.xml");
    expect(manifest).toContain('level="requireAdministrator"');
  });
});
