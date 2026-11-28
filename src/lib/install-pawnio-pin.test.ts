import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** PawnIO_setup.exe 2.2.0 from namazso/PawnIO.Setup (measured on official release asset). */
const OFFICIAL_PAWNIO_220_SHA256 =
  "1F519A22E47187F70A1379A48CA604981C4FCF694F4E65B734AAA74A9FBA3032";
const OFFICIAL_PAWNIO_220_SIGNER_THUMBPRINT =
  "F380DCC9F706E2756A5047B832FFE719E1BC35F5";

const PAWNIO_URL =
  "https://github.com/namazso/PawnIO.Setup/releases/download/2.2.0/PawnIO_setup.exe";

const PAWNIO_PIN_MISMATCH_EXIT = 56;

const isWindows = process.platform === "win32";

const windowsPowerShell = "powershell.exe";

const ps51Modules = join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "Modules",
);
const psEnv = { ...process.env, PSModulePath: ps51Modules };

describe("PawnIO 2.2.0 pin (#56)", () => {
  it("declares pinned SHA-256 and signer thumbprint constants", () => {
    const ps1 = read("scripts/install-pawnio.ps1");
    expect(ps1).toMatch(/PAWNIO_SETUP_SHA256\s*=\s*'/);
    expect(ps1).toMatch(/PAWNIO_SIGNER_THUMBPRINT\s*=\s*'/);
    expect(ps1).toContain(OFFICIAL_PAWNIO_220_SHA256);
    expect(ps1).toContain(OFFICIAL_PAWNIO_220_SIGNER_THUMBPRINT);
    expect(ps1).toMatch(/Security\.Cryptography\.SHA256/);
    expect(ps1).toMatch(/CreateFromSignedFile/);
    expect(ps1).toMatch(/GetCertHashString/);
    expect(ps1).toMatch(/VerifyAuthenticodeSignature/);
    expect(ps1).toMatch(/function Invoke-PawnIOInstall/);
    expect(ps1).toContain(`$script:PAWNIO_PIN_MISMATCH_EXIT = ${PAWNIO_PIN_MISMATCH_EXIT}`);
    expect(ps1).toMatch(/Start-Service/);
    expect(ps1).toMatch(/function Ensure-PawnIOServiceRunning/);
  });
});

describe.skipIf(!isWindows)(
  "PawnIO 2.2.0 verification (Windows runtime)",
  () => {
    const repoRoot = process.cwd();
    const scriptPath = join(repoRoot, "scripts", "install-pawnio.ps1");
    let officialSetupPath: string;
    let cacheDir: string;

    beforeAll(async () => {
      cacheDir = mkdtempSync(join(tmpdir(), "pc-temp-pawnio-pin-"));
      officialSetupPath = join(cacheDir, "PawnIO_setup.exe");
      const destEsc = officialSetupPath.replace(/'/g, "''");
      for (let i = 0; i < 3; i++) {
        try {
          execSync(
            [
              "$ProgressPreference = 'SilentlyContinue'",
              `Invoke-WebRequest -Uri '${PAWNIO_URL}' -OutFile '${destEsc}' -UseBasicParsing -TimeoutSec 120`,
            ].join("; "),
            {
              shell: "powershell.exe",
              stdio: "pipe",
              timeout: 180_000,
              env: psEnv,
            },
          );
          break;
        } catch (e) {
          if (i === 2) {
            throw e;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      const hash = createHash("sha256")
        .update(readFileSync(officialSetupPath))
        .digest("hex")
        .toUpperCase();
      expect(hash).toBe(OFFICIAL_PAWNIO_220_SHA256);
    }, 180_000);

    afterAll(() => {
      try {
        execSync(
          `Remove-Item -LiteralPath '${cacheDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`,
          {
            shell: "powershell.exe",
            stdio: "ignore",
            env: psEnv,
          },
        );
      } catch {
        /* ignore */
      }
    });

    // NSIS runs Windows PowerShell 5.1; reproduce a PS7-polluted PSModulePath and never fall back to pwsh.
    const pollutedEnv = {
      ...process.env,
      PSModulePath: [
        join(
          process.env.ProgramFiles ?? "C:\\Program Files",
          "PowerShell",
          "7",
          "Modules",
        ),
        ps51Modules,
      ].join(";"),
    };

    const runPowerShell = (command: string) =>
      execSync(
        `${windowsPowerShell} -NoProfile -Command "${command.replace(/"/g, '\\"')}"`,
        {
          encoding: "utf8",
          timeout: 60_000,
          env: pollutedEnv,
        },
      );

    it("accepts the official 2.2.0 setup executable", () => {
      const out = runPowerShell(
        `. '${scriptPath.replace(/'/g, "''")}'; Test-PawnIOSetupAuthenticode -Path '${officialSetupPath.replace(/'/g, "''")}'`,
      ).trim();
      expect(out.endsWith("True")).toBe(true);
    });

    it("rejects a valid signature when the SHA-256 pin does not match", () => {
      const out = runPowerShell(
        [
          `. '${scriptPath.replace(/'/g, "''")}'`,
          `$script:PAWNIO_SETUP_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000'`,
          `Test-PawnIOSetupAuthenticode -Path '${officialSetupPath.replace(/'/g, "''")}'`,
        ].join("; "),
      ).trim();
      expect(out.endsWith("False")).toBe(true);
    });

    it("logs expected and actual SHA-256 when the hash pin does not match", () => {
      const zero =
        "0000000000000000000000000000000000000000000000000000000000000000";
      const output = runPowerShell(
        [
          `. '${scriptPath.replace(/'/g, "''")}'`,
          `$script:PAWNIO_SETUP_SHA256 = '${zero}'`,
          `[void](Test-PawnIOSetupAuthenticode -Path '${officialSetupPath.replace(/'/g, "''")}')`,
        ].join("; "),
      );
      expect(output).toMatch(/expected 0{64}/i);
      expect(output).toMatch(
        new RegExp(`actual ${OFFICIAL_PAWNIO_220_SHA256}`, "i"),
      );
    });

    it("logs expected and actual thumbprint when the signer pin does not match", () => {
      const zero =
        "0000000000000000000000000000000000000000000000000000000000000000";
      const output = runPowerShell(
        [
          `. '${scriptPath.replace(/'/g, "''")}'`,
          `$script:PAWNIO_SIGNER_THUMBPRINT = '${zero}'`,
          `[void](Test-PawnIOSetupAuthenticode -Path '${officialSetupPath.replace(/'/g, "''")}')`,
        ].join("; "),
      );
      expect(output).toMatch(/expected 0{40}/i);
      expect(output).toMatch(
        new RegExp(`actual ${OFFICIAL_PAWNIO_220_SIGNER_THUMBPRINT}`, "i"),
      );
    });

    it("surfaces the manual-install notice on pin mismatch and exits with pin failure code", () => {
      const scriptEsc = scriptPath.replace(/'/g, "''");
      const setupEsc = officialSetupPath.replace(/'/g, "''");
      const cacheEsc = cacheDir.replace(/'/g, "''");

      const output = runPowerShell(
        [
          "$ErrorActionPreference = 'Stop'",
          `. '${scriptEsc}' -NoPrompt`,
          "$script:PAWNIO_UNINSTALL_REG = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PawnIO_PinTestStub'",
          "function Get-Service { param($Name, $ErrorAction) return $null }",
          `$script:PAWNIO_SETUP_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000'`,
          "$script:setupRan = $false",
          "$script:cleanedDir = $null",
          "function Test-PawnIOInstalled { $false }",
          `function Get-PawnIOSetupDownloadDir { '${cacheEsc}' }`,
          `function Get-PawnIOSetupExe { param($DownloadDir) '${setupEsc}' }`,
          "function Invoke-PawnIOSetup { param($SetupPath) $script:setupRan = $true; 0 }",
          "function Remove-PawnIOSetupDownloadDir { param($Dir) $script:cleanedDir = $Dir }",
          "$code = Invoke-PawnIOInstall",
          'Write-Host "EXIT=$code SETUP_RAN=$($script:setupRan) CLEANED=$($script:cleanedDir)"',
        ].join("; "),
      );

      expect(output).toMatch(new RegExp(`EXIT=${PAWNIO_PIN_MISMATCH_EXIT}`));
      expect(output).toMatch(/SETUP_RAN=False/i);
      expect(output).toMatch(new RegExp(`CLEANED=${cacheEsc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      expect(output).toMatch(/could not install the PawnIO driver automatically/i);
      expect(output).toMatch(/namazso\/PawnIO\.Setup\/releases\/latest/);
      expect(output).toMatch(/release pin verification/i);
    });

    it("exits with pin failure code when pin verification throws", () => {
      const scriptEsc = scriptPath.replace(/'/g, "''");
      const setupEsc = officialSetupPath.replace(/'/g, "''");
      const cacheEsc = cacheDir.replace(/'/g, "''");

      const output = runPowerShell(
        [
          "$ErrorActionPreference = 'Stop'",
          `. '${scriptEsc}' -NoPrompt`,
          "$script:PAWNIO_UNINSTALL_REG = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PawnIO_PinTestStub'",
          "function Get-Service { param($Name, $ErrorAction) return $null }",
          "$script:setupRan = $false",
          "function Test-PawnIOInstalled { $false }",
          `function Get-PawnIOSetupDownloadDir { '${cacheEsc}' }`,
          `function Get-PawnIOSetupExe { param($DownloadDir) '${setupEsc}' }`,
          "function Test-PawnIOSetupAuthenticode { param($Path) throw 'boom' }",
          "function Invoke-PawnIOSetup { param($SetupPath) $script:setupRan = $true; 0 }",
          "function Remove-PawnIOSetupDownloadDir { param($Dir) }",
          "$code = Invoke-PawnIOInstall",
          'Write-Host "EXIT=$code SETUP_RAN=$($script:setupRan)"',
        ].join("; "),
      );

      expect(output).toMatch(new RegExp(`EXIT=${PAWNIO_PIN_MISMATCH_EXIT}`));
      expect(output).toMatch(/SETUP_RAN=False/i);
    });

    it("shows manual notice when setup succeeds but the driver is not running", () => {
      const scriptEsc = scriptPath.replace(/'/g, "''");
      const setupEsc = officialSetupPath.replace(/'/g, "''");
      const cacheEsc = cacheDir.replace(/'/g, "''");

      const output = runPowerShell(
        [
          "$ErrorActionPreference = 'Stop'",
          `. '${scriptEsc}' -NoPrompt`,
          "$script:PAWNIO_UNINSTALL_REG = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PawnIO_PinTestStub'",
          "function Get-Service { param($Name, $ErrorAction) return $null }",
          "function Test-PawnIOInstalled { $false }",
          `function Get-PawnIOSetupDownloadDir { '${cacheEsc}' }`,
          `function Get-PawnIOSetupExe { param($DownloadDir) '${setupEsc}' }`,
          "function Invoke-PawnIOSetup { param($SetupPath) 0 }",
          "function Ensure-PawnIOServiceRunning { $false }",
          "function Remove-PawnIOSetupDownloadDir { param($Dir) }",
          "$code = Invoke-PawnIOInstall",
          'Write-Host "EXIT=$code"',
        ].join("; "),
      );

      expect(output).toMatch(/EXIT=0/);
      expect(output).toMatch(
        /driver is not running; restart Windows before CPU temperatures are available/i,
      );
      expect(output).toMatch(/could not install the PawnIO driver automatically/i);
    });

    const runWithServiceStub = (status: string, startThrows: boolean) =>
      runPowerShell(
        [
          `. '${scriptPath.replace(/'/g, "''")}' -NoPrompt`,
          "$script:started = $false",
          `function Get-Service { param($Name, $ErrorAction) $o = [pscustomobject]@{ Status = '${status}' }; $o | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value { param($s, $t) throw 'timed out' }; $o }`,
          `function Start-Service { param($Name, $ErrorAction) $script:started = $true; ${startThrows ? "throw 'cannot start'" : ""} }`,
          "$r = Test-PawnIOInstalled",
          'Write-Host "INSTALLED=$r STARTED=$($script:started)"',
        ].join("; "),
      );

    it("treats a registered but stopped PawnIO service that cannot start as not installed", () => {
      const out = runWithServiceStub("Stopped", true);
      expect(out).toMatch(/INSTALLED=False STARTED=True/);
      expect(out).toMatch(/could not be started/);
      expect(out).toMatch(/registered but not running; skipping automatic setup/);
    });

    it("skips setup without starting anything when PawnIO is already running", () => {
      const out = runWithServiceStub("Running", false);
      expect(out).toMatch(/INSTALLED=True STARTED=False/);
    });
  },
);