import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const isWindows = process.platform === "win32";

const windowsPowerShell = "powershell.exe";

describe("PawnIO 2.2.0 pin (#56)", () => {
  it("declares pinned SHA-256 and signer thumbprint constants", () => {
    const ps1 = read("scripts/install-pawnio.ps1");
    expect(ps1).toMatch(/PAWNIO_SETUP_SHA256\s*=\s*'/);
    expect(ps1).toMatch(/PAWNIO_SIGNER_THUMBPRINT\s*=\s*'/);
    expect(ps1).toContain(OFFICIAL_PAWNIO_220_SHA256);
    expect(ps1).toContain(OFFICIAL_PAWNIO_220_SIGNER_THUMBPRINT);
    expect(ps1).toMatch(/Get-FileHash[\s\S]*SHA256/);
    expect(ps1).toMatch(/SignerCertificate\.Thumbprint/);
  });
});

describe.skipIf(!isWindows)(
  "PawnIO 2.2.0 verification (Windows runtime)",
  () => {
    const repoRoot = process.cwd();
    const scriptPath = join(repoRoot, "scripts", "install-pawnio.ps1");
    let officialSetupPath: string;
    let cacheDir: string;

    beforeAll(() => {
      cacheDir = mkdtempSync(join(tmpdir(), "pc-temp-pawnio-pin-"));
      officialSetupPath = join(cacheDir, "PawnIO_setup.exe");
      if (!existsSync(officialSetupPath)) {
        execSync(
          [
            "$ProgressPreference = 'SilentlyContinue'",
            `Invoke-WebRequest -Uri '${PAWNIO_URL}' -OutFile '${officialSetupPath.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec 120`,
          ].join("; "),
          { shell: "powershell.exe", stdio: "pipe", timeout: 180_000 },
        );
      }
      const hash = execSync(
        `Get-FileHash -LiteralPath '${officialSetupPath.replace(/'/g, "''")}' -Algorithm SHA256 | Select-Object -ExpandProperty Hash`,
        { shell: "powershell.exe", encoding: "utf8" },
      ).trim();
      expect(hash).toBe(OFFICIAL_PAWNIO_220_SHA256);
    }, 180_000);

    afterAll(() => {
      try {
        execSync(`Remove-Item -LiteralPath '${cacheDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`, {
          shell: "powershell.exe",
          stdio: "ignore",
        });
      } catch {
        /* ignore */
      }
    });

    const runPowerShell = (command: string) =>
      execSync(
        `${windowsPowerShell} -NoProfile -Command "${command.replace(/"/g, '\\"')}"`,
        {
          encoding: "utf8",
          timeout: 60_000,
        },
      );

    it("accepts the official 2.2.0 setup executable", () => {
      const setup = officialSetupPath.replace(/\\/g, "\\\\");
      const out = runPowerShell(
        `. '${scriptPath.replace(/'/g, "''")}'; Test-PawnIOSetupAuthenticode -Path '${setup.replace(/'/g, "''")}'`,
      ).trim();
      expect(out.endsWith("True")).toBe(true);
    });

    it("rejects a valid signature when the SHA-256 pin does not match", () => {
      const setup = officialSetupPath.replace(/\\/g, "\\\\");
      const out = runPowerShell(
        [
          `. '${scriptPath.replace(/'/g, "''")}'`,
          `$script:PAWNIO_SETUP_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000'`,
          `Test-PawnIOSetupAuthenticode -Path '${setup.replace(/'/g, "''")}'`,
        ].join("; "),
      ).trim();
      expect(out.endsWith("False")).toBe(true);
    });

    it("surfaces the manual-install notice on pin mismatch and exits 0", () => {
      const setup = officialSetupPath.replace(/\\/g, "\\\\");
      const harness = join(cacheDir, "pin-mismatch-harness.ps1");
      writeFileSync(
        harness,
        `
$ErrorActionPreference = 'Stop'
. '${scriptPath.replace(/'/g, "''")}' -NoPrompt
$script:PAWNIO_SETUP_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000'
$exitCode = 0
try {
  if (-not (Test-PawnIOSetupAuthenticode -Path '${setup.replace(/'/g, "''")}')) {
    throw 'PawnIO setup failed release pin verification.'
  }
} catch {
  Write-InstallDetail "PawnIO install step failed: $($_.Exception.Message)"
  Show-PawnIOManualInstallNotice
  $exitCode = 0
}
exit $exitCode
`,
        "utf8",
      );

      const output = execSync(
        `${windowsPowerShell} -NoProfile -File "${harness}"`,
        {
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      expect(output).toMatch(/could not install the PawnIO driver automatically/i);
      expect(output).toMatch(/namazso\/PawnIO\.Setup\/releases\/latest/);
    });
  },
);