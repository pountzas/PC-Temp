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
      windows?: { nsis?: { installerHooks?: string; installMode?: string } };
    };
  };

  it("bundles the LHM sidecar and builds it before the Tauri bundle", () => {
    expect(conf.bundle.externalBin).toEqual(["binaries/lhm-reader"]);
    expect(conf.build.beforeBuildCommand).toMatch(/build-sidecar\.ps1/);
  });

  it("targets NSIS with per-machine install and installer hooks", () => {
    const targets = conf.bundle.targets;
    expect(
      targets === "nsis" ||
        (Array.isArray(targets) && targets.includes("nsis")),
    ).toBe(true);
    expect(conf.bundle.windows?.nsis?.installerHooks).toBe(
      "./windows/hooks.nsh",
    );
    expect(conf.bundle.windows?.nsis?.installMode).toBe("perMachine");
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
    expect(ps1).toMatch(/CreateFromSignedFile/);
    expect(ps1).toMatch(/VerifyAuthenticodeSignature/);
    expect(ps1).toContain("PAWNIO_SETUP_SHA256");
    expect(ps1).toMatch(/function Invoke-PawnIOInstall/);
    expect(ps1).toMatch(/3010/);
    expect(ps1).toMatch(/ProgressPreference\s*=\s*'SilentlyContinue'/);
    expect(ps1).toMatch(/TimeoutSec\s+120/);
    expect(ps1).toMatch(/NoPrompt/);
  });

  it("install-pawnio downloads setup outside TEMP to an admin-only folder (#54)", () => {
    const ps1 = read("scripts/install-pawnio.ps1");
    expect(ps1).not.toMatch(/\$env:TEMP/i);
    expect(ps1).toMatch(
      /Join-Path\s+\$env:ProgramData\s+\([^)]*NewGuid\(\)/,
    );
    expect(ps1).not.toMatch(/PC-Temp\\pawnio-setup'/);
    expect(ps1).toMatch(/SetAccessRuleProtection\(\$true,\s*\$false\)/);
    expect(ps1).toMatch(/S-1-5-32-544/);
    expect(ps1).toMatch(/S-1-5-18/);
    expect(ps1).toMatch(
      /\[System\.IO\.Directory\]::CreateDirectory\(\$dir,\s*\$acl\)/,
    );
    expect(ps1).toMatch(/ReparsePoint/);
    expect(
      ps1.indexOf("Test-PawnIOSetupAuthenticode -Path $setup"),
    ).toBeLessThan(ps1.indexOf("Invoke-PawnIOSetup -SetupPath $setup"));
    expect(ps1).toMatch(/finally\s*\{[\s\S]*Remove-PawnIOSetupDownloadDir/);
  });

  it("NSIS hooks run PawnIO at INSTDIR and remove the PC-Temp scheduled task", () => {
    const hooks = read("src-tauri/windows/hooks.nsh");
    expect(hooks).toMatch(/NSIS_HOOK_POSTINSTALL/);
    expect(hooks).toContain('"$INSTDIR\\install-pawnio.ps1"');
    expect(hooks).not.toMatch(/\$INSTDIR\\resources\\/i);
    expect(hooks).toMatch(/IfFileExists/);
    expect(hooks).toMatch(/\$\{Silent\}/);
    expect(hooks).toMatch(/-NoPrompt/);
    expect(hooks).toMatch(/NSIS_HOOK_POSTUNINSTALL/);
    expect(hooks).toMatch(/schtasks.*PC-Temp/i);
    expect(hooks).toMatch(/schtasks delete exit/);
    expect(hooks).toContain("$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe");
    expect(hooks).toContain("$SYSDIR\\schtasks.exe");
    expect(hooks).not.toMatch(/ExecWait[^`]*`powershell\.exe /);
    expect(hooks).not.toMatch(/ExecWait[^`]*`schtasks\.exe /);
    expect(hooks).toMatch(/\$\{If\} \$0 == 56/);
    expect(hooks).toMatch(/nsExec::ExecToLog/);
    expect(hooks).toMatch(/WARNING: PawnIO download failed release pin verification/);
  });

  it("POSTINSTALL hardens install dir ACL under Program Files (#57)", () => {
    const hooks = read("src-tauri/windows/hooks.nsh");
    expect(hooks).toMatch(/\$PROGRAMFILES64\\/);
    expect(hooks).toMatch(/\$SYSDIR\\icacls\.exe/);
    expect(hooks).toContain("*S-1-5-32-544:(OI)(CI)F");
    expect(hooks).toContain("*S-1-5-18:(OI)(CI)F");
    expect(hooks).toContain(
      "*S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464:(OI)(CI)F",
    );
    expect(hooks).toContain("*S-1-5-32-545:(OI)(CI)RX");
    expect(hooks).toMatch(/\$INSTDIR\\\*" \/reset \/T/);
    expect(hooks).toMatch(/\/inheritance:r/i);
    expect(hooks).not.toMatch(/inheritance:r[^`]*\/T/);
    const pawnioIdx = hooks.indexOf("install-pawnio.ps1");
    const hardenIdx = hooks.indexOf("Hardening install folder");
    expect(hardenIdx).toBeGreaterThan(-1);
    expect(pawnioIdx).toBeGreaterThan(-1);
    expect(hardenIdx).toBeLessThan(pawnioIdx);
  });

  it("release workflow is manual dispatch with SHA-pinned actions and bundle asserts", () => {
    const yml = read(".github/workflows/release.yml");
    expect(yml).toMatch(/workflow_dispatch/);
    expect(yml).toMatch(/uses:\s+\S+@\S+\s+#/);
    expect(yml).toMatch(/WinRing0/i);
    expect(yml).toMatch(/PawnIO/i);
    expect(yml).toMatch(/lhm-reader\.exe/);
    expect(yml).toMatch(/pc-temp\.exe/);
    expect(yml).toMatch(/\.woff2/);
  });

  it("CI builds the sidecar before Cargo and Tauri", () => {
    const yml = read(".github/workflows/ci.yml");
    expect(yml).toMatch(
      /actions\/setup-dotnet@87b7050bc53ea08284295505d98d2aa94301e852/,
    );
    expect(yml).toMatch(/build-sidecar\.ps1/);
    const sidecarIdx = yml.indexOf("build-sidecar");
    const cargoIdx = yml.indexOf("Cargo tests");
    const tauriIdx = yml.indexOf("Tauri build");
    expect(sidecarIdx).toBeGreaterThan(-1);
    expect(cargoIdx).toBeGreaterThan(sidecarIdx);
    expect(tauriIdx).toBeGreaterThan(sidecarIdx);
  });

  it("installed app requests administrator elevation", () => {
    const manifest = read("src-tauri/manifest.xml");
    expect(manifest).toContain('level="requireAdministrator"');
  });
});
