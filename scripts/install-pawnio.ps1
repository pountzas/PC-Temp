# Downloads and silently installs the official PawnIO driver when missing (issue #21).
# PawnIO is never bundled; on failure we surface the manual link and exit 0 so PC-Temp still installs.
# Official PawnIO.Setup 2.2.0 CLI (verified): PawnIO_setup.exe -install -silent (exit 0 = ok, 3010 = reboot pending).
param(
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$script:PAWNIO_VERSION = '2.2.0'
$script:PAWNIO_SETUP_URL = "https://github.com/namazso/PawnIO.Setup/releases/download/$($script:PAWNIO_VERSION)/PawnIO_setup.exe"
$script:PAWNIO_MANUAL_URL = 'https://github.com/namazso/PawnIO.Setup/releases/latest'
$script:PAWNIO_SETUP_ARGS = @('-install', '-silent')
$script:PAWNIO_REBOOT_EXIT_CODE = 3010
$script:PAWNIO_UNINSTALL_REG = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO'
$script:PAWNIO_SERVICE_NAME = 'PawnIO'

function Write-InstallDetail {
    param([string]$Message)
    if (-not $Quiet) {
        Write-Host $Message
    }
}

function Test-PawnIOInstalled {
    if (Test-Path -LiteralPath $script:PAWNIO_UNINSTALL_REG) {
        return $true
    }
    $svc = Get-Service -Name $script:PAWNIO_SERVICE_NAME -ErrorAction SilentlyContinue
    return $null -ne $svc
}

function Test-PawnIOSetupAuthenticode {
    param([Parameter(Mandatory)] [string]$Path)

    $sig = Get-AuthenticodeSignature -FilePath $Path
    if ($sig.Status -ne 'Valid') {
        return $false
    }
    $subject = $sig.SignerCertificate.Subject
    return $subject -match 'namazso'
}

function Get-PawnIOSetupExe {
    $dest = Join-Path $env:TEMP 'PC-Temp-PawnIO_setup.exe'
    if (Test-Path -LiteralPath $dest) {
        Remove-Item -Force -LiteralPath $dest
    }
    Write-InstallDetail "Downloading PawnIO $($script:PAWNIO_VERSION) from the official release..."
    Invoke-WebRequest -Uri $script:PAWNIO_SETUP_URL -OutFile $dest -UseBasicParsing
    return $dest
}

function Invoke-PawnIOSetup {
    param([Parameter(Mandatory)] [string]$SetupPath)

    $proc = Start-Process -FilePath $SetupPath -ArgumentList $script:PAWNIO_SETUP_ARGS -Wait -PassThru
    return $proc.ExitCode
}

function Show-PawnIOManualInstallNotice {
    $text = @"
PC-Temp could not install the PawnIO driver automatically.
CPU temperature readings will show as unavailable until PawnIO is installed.

Download the official PawnIO setup here:
$($script:PAWNIO_MANUAL_URL)
"@
    Write-InstallDetail $text
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        [System.Windows.Forms.MessageBox]::Show(
            $text,
            'PC-Temp — install PawnIO manually',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    } catch {
        # Headless / restricted hosts: message already logged.
    }
}

if (Test-PawnIOInstalled) {
    Write-InstallDetail 'PawnIO is already installed; skipping.'
    exit 0
}

try {
    $setup = Get-PawnIOSetupExe
    if (-not (Test-PawnIOSetupAuthenticode -Path $setup)) {
        throw 'PawnIO setup failed Authenticode verification (expected valid namazso signature).'
    }

    $exitCode = Invoke-PawnIOSetup -SetupPath $setup
    switch ($exitCode) {
        0 {
            Write-InstallDetail 'PawnIO installed successfully.'
            exit 0
        }
        $script:PAWNIO_REBOOT_EXIT_CODE {
            Write-InstallDetail 'PawnIO installed; a reboot is required before CPU temperatures are available.'
            exit 0
        }
        default {
            throw "PawnIO setup exited with code $exitCode."
        }
    }
} catch {
    Write-InstallDetail "PawnIO install step failed: $($_.Exception.Message)"
    Show-PawnIOManualInstallNotice
    exit 0
}