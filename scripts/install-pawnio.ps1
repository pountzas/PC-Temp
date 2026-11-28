# Downloads and silently installs the official PawnIO driver when missing (issue #21).
# PawnIO is never bundled; generic failures surface the manual link and exit 0 so PC-Temp still installs.
# Pin mismatch exits 56; NSIS logs a warning (#56).
# Official PawnIO.Setup 2.2.0 CLI (verified): PawnIO_setup.exe -install -silent (exit 0 = ok, 3010 = reboot pending).
param(
    [switch]$Quiet,
    [switch]$NoPrompt
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$script:PAWNIO_VERSION = '2.2.0'
$script:PAWNIO_SETUP_URL = "https://github.com/namazso/PawnIO.Setup/releases/download/$($script:PAWNIO_VERSION)/PawnIO_setup.exe"
$script:PAWNIO_MANUAL_URL = 'https://github.com/namazso/PawnIO.Setup/releases/latest'
$script:PAWNIO_SETUP_ARGS = @('-install', '-silent')
$script:PAWNIO_REBOOT_EXIT_CODE = 3010
$script:PAWNIO_PIN_MISMATCH_EXIT = 56
$script:PAWNIO_UNINSTALL_REG = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO'
$script:PAWNIO_SERVICE_NAME = 'PawnIO'
# PawnIO_setup.exe 2.2.0 release asset (SHA-256 and Authenticode signer thumbprint).
$script:PAWNIO_SETUP_SHA256 = '1F519A22E47187F70A1379A48CA604981C4FCF694F4E65B734AAA74A9FBA3032'
$script:PAWNIO_SIGNER_THUMBPRINT = 'F380DCC9F706E2756A5047B832FFE719E1BC35F5'

function Write-InstallDetail {
    param([string]$Message)
    if (-not $Quiet) {
        Write-Host $Message
    }
}

function Ensure-PawnIOServiceRunning {
    $svc = Get-Service -Name $script:PAWNIO_SERVICE_NAME -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        Write-InstallDetail 'PawnIO service is not registered.'
        return $false
    }

    if ($svc.Status -eq 'Running') {
        return $true
    }

    try {
        Write-InstallDetail "Starting PawnIO service (was $($svc.Status))..."
        Start-Service -Name $script:PAWNIO_SERVICE_NAME -ErrorAction Stop
        $svc.WaitForStatus('Running', (New-TimeSpan -Seconds 30))
    } catch {
        Write-InstallDetail "PawnIO service could not be started: $($_.Exception.Message)"
        return $false
    }

    return $svc.Status -eq 'Running'
}

function Test-PawnIOInstalled {
    $registered = $false
    if (Test-Path -LiteralPath $script:PAWNIO_UNINSTALL_REG) {
        $registered = $true
    }
    $svc = Get-Service -Name $script:PAWNIO_SERVICE_NAME -ErrorAction SilentlyContinue
    if ($null -ne $svc) {
        $registered = $true
    }

    if (-not $registered) {
        return $false
    }

    if (Ensure-PawnIOServiceRunning) {
        return $true
    }

    Write-InstallDetail 'PawnIO is registered but not running; retrying setup.'
    return $false
}

function Initialize-PawnIOAuthenticodeHelper {
    if (([System.Management.Automation.PSTypeName]'PawnIOAuthenticode').Type) {
        return
    }

    $code = @'
using System;
using System.Runtime.InteropServices;

public static class PawnIOAuthenticode {
    private static readonly IntPtr InvalidHandle = new IntPtr(-1);
    private static readonly Guid WinTrustVerify = new Guid("{00AAC56B-CD44-11d0-8CC2-00C04FC295EE}");

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WinTrustFileInfo {
        public uint cbStruct;
        public string pcwszFilePath;
        public IntPtr hFile;
        public IntPtr pgKnownSubject;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WinTrustData {
        public uint cbStruct;
        public IntPtr pPolicyCallbackData;
        public IntPtr pSIPClientData;
        public uint dwUIChoice;
        public uint fdwRevocationChecks;
        public uint dwUnionChoice;
        public IntPtr pFile;
        public uint dwStateAction;
        public IntPtr hWVTStateData;
        public IntPtr pwszURLReference;
        public uint dwProvFlags;
        public uint dwUIContext;
    }

    private const uint WtdUiNone = 2;
    private const uint WtdRevokeNone = 0;
    private const uint WtdChoiceFile = 1;
    private const uint WtdStateActionVerify = 1;
    private const uint WtdStateActionClose = 2;
    private const uint WtdCacheOnlyUrlRetrieval = 0x1000;

    [DllImport("wintrust.dll", ExactSpelling = true, SetLastError = false, CharSet = CharSet.Unicode)]
    private static extern int WinVerifyTrust(IntPtr hwnd, [MarshalAs(UnmanagedType.LPStruct)] Guid pgActionID, ref WinTrustData pWVTData);

    public static bool VerifyAuthenticodeSignature(string path) {
        var fileInfo = new WinTrustFileInfo {
            cbStruct = (uint)Marshal.SizeOf(typeof(WinTrustFileInfo)),
            pcwszFilePath = path,
            hFile = InvalidHandle,
            pgKnownSubject = IntPtr.Zero,
        };

        var fileInfoPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(WinTrustFileInfo)));
        try {
            Marshal.StructureToPtr(fileInfo, fileInfoPtr, false);

            var trustData = new WinTrustData {
                cbStruct = (uint)Marshal.SizeOf(typeof(WinTrustData)),
                dwUIChoice = WtdUiNone,
                fdwRevocationChecks = WtdRevokeNone,
                dwUnionChoice = WtdChoiceFile,
                pFile = fileInfoPtr,
                dwStateAction = WtdStateActionVerify,
                dwProvFlags = WtdCacheOnlyUrlRetrieval,
            };

            int result = WinVerifyTrust(IntPtr.Zero, WinTrustVerify, ref trustData);
            trustData.dwStateAction = WtdStateActionClose;
            WinVerifyTrust(IntPtr.Zero, WinTrustVerify, ref trustData);
            return result == 0;
        } finally {
            Marshal.FreeHGlobal(fileInfoPtr);
        }
    }
}
'@

    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction Stop
}

function Test-PawnIOSetupAuthenticode {
    param([Parameter(Mandatory)] [string]$Path)

    Initialize-PawnIOAuthenticodeHelper
    if (-not [PawnIOAuthenticode]::VerifyAuthenticodeSignature($Path)) {
        Write-InstallDetail 'PawnIO setup Authenticode status is NotValid (expected Valid).'
        return $false
    }

    $signerCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromSignedFile($Path)
    try {
        $actualThumbprint = $signerCert.GetCertHashString().ToUpperInvariant()
    } finally {
        $signerCert.Dispose()
    }

    $expectedThumbprint = $script:PAWNIO_SIGNER_THUMBPRINT.ToUpperInvariant()
    if ($actualThumbprint -ne $expectedThumbprint) {
        Write-InstallDetail "PawnIO setup signer thumbprint mismatch: expected $expectedThumbprint, actual $actualThumbprint."
        return $false
    }

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hash = ([System.BitConverter]::ToString($sha256.ComputeHash($stream)) -replace '-', '').ToUpperInvariant()
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
    $expectedHash = $script:PAWNIO_SETUP_SHA256.ToUpperInvariant()
    if ($hash -ne $expectedHash) {
        Write-InstallDetail "PawnIO setup SHA-256 mismatch: expected $expectedHash, actual $hash."
        return $false
    }

    return $true
}

function Get-PawnIOSetupDownloadDir {
    $dir = Join-Path $env:ProgramData ('PC-Temp-pawnio-setup-' + [guid]::NewGuid().ToString('N'))
    if (Test-Path -LiteralPath $dir) {
        throw "Refusing to reuse existing PawnIO download folder $dir."
    }

    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $admins = New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544'
    $system = New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-18'
    $acl.SetOwner($admins)
    foreach ($sid in @($system, $admins)) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }

    [System.IO.Directory]::CreateDirectory($dir, $acl) | Out-Null

    $item = Get-Item -LiteralPath $dir -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw "PawnIO download folder $dir is a reparse point."
    }
    return $dir
}

function Remove-PawnIOSetupDownloadDir {
    param([Parameter(Mandatory)] [string]$Dir)

    if (-not (Test-Path -LiteralPath $Dir)) {
        return
    }
    $item = Get-Item -LiteralPath $Dir -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        [System.IO.Directory]::Delete($Dir, $false)
        return
    }
    Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
}

function Get-PawnIOSetupExe {
    param([Parameter(Mandatory)] [string]$DownloadDir)

    $dest = Join-Path $DownloadDir 'PawnIO_setup.exe'
    if (Test-Path -LiteralPath $dest) {
        Remove-Item -Force -LiteralPath $dest
    }
    Write-InstallDetail "Downloading PawnIO $($script:PAWNIO_VERSION) from the official release..."
    Invoke-WebRequest -Uri $script:PAWNIO_SETUP_URL -OutFile $dest -UseBasicParsing -TimeoutSec 120
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
    if ($NoPrompt) {
        return
    }
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

function Invoke-PawnIOInstall {
    if (Test-PawnIOInstalled) {
        Write-InstallDetail 'PawnIO is already installed and running; skipping.'
        return 0
    }

    if ((Test-Path -LiteralPath $script:PAWNIO_UNINSTALL_REG) -or (
            $null -ne (Get-Service -Name $script:PAWNIO_SERVICE_NAME -ErrorAction SilentlyContinue))) {
        Write-InstallDetail 'PawnIO is registered but the driver is not running; restart Windows before CPU temperatures are available.'
        Show-PawnIOManualInstallNotice
        return 0
    }

    $pawnioSetupDownloadDir = $null
    $pinFailed = $false
    try {
        $pawnioSetupDownloadDir = Get-PawnIOSetupDownloadDir
        $setup = Get-PawnIOSetupExe -DownloadDir $pawnioSetupDownloadDir
        $pinOk = $false
        try {
            $pinOk = Test-PawnIOSetupAuthenticode -Path $setup
        } catch {
            Write-InstallDetail "PawnIO setup pin verification error: $($_.Exception.Message)"
        }
        if (-not $pinOk) {
            $pinFailed = $true
            throw 'PawnIO setup failed release pin verification (expected PawnIO 2.2.0 hash and signer).'
        }

        $exitCode = Invoke-PawnIOSetup -SetupPath $setup
        switch ($exitCode) {
            0 {
                if (Ensure-PawnIOServiceRunning) {
                    Write-InstallDetail 'PawnIO installed successfully and the service is running.'
                } else {
                    Write-InstallDetail 'PawnIO installed but the driver is not running; restart Windows before CPU temperatures are available.'
                    Show-PawnIOManualInstallNotice
                }
                return 0
            }
            $script:PAWNIO_REBOOT_EXIT_CODE {
                Write-InstallDetail 'PawnIO installed; a reboot is required before CPU temperatures are available.'
                return 0
            }
            default {
                Write-InstallDetail "PawnIO setup exited with code $exitCode; restart Windows or install PawnIO manually."
                Show-PawnIOManualInstallNotice
                return 0
            }
        }
    } catch {
        $msg = $_.Exception.Message
        Write-InstallDetail "PawnIO install step failed: $msg"
        Show-PawnIOManualInstallNotice
        if ($pinFailed) {
            return $script:PAWNIO_PIN_MISMATCH_EXIT
        }
        return 0
    } finally {
        if ($pawnioSetupDownloadDir) {
            Remove-PawnIOSetupDownloadDir -Dir $pawnioSetupDownloadDir
        }
    }
}

if ($MyInvocation.InvocationName -eq '.') {
    Initialize-PawnIOAuthenticodeHelper
}

if ($MyInvocation.InvocationName -ne '.') {
    exit (Invoke-PawnIOInstall)
}