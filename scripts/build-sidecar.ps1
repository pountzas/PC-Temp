# Builds the LHM CPU sidecar and copies it to the Tauri externalBin path.
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$SidecarDir = Join-Path $RepoRoot 'sidecar/lhm-reader'
$Project = Join-Path $SidecarDir 'lhm-reader.csproj'
$BinaryDir = Join-Path $RepoRoot 'src-tauri/binaries'
$DestName = 'lhm-reader-x86_64-pc-windows-msvc.exe'
$SourceExe = Join-Path $SidecarDir "bin/$Configuration/net481/lhm-reader.exe"

Write-Host "Building lhm-reader ($Configuration)..."
Push-Location $SidecarDir
try {
    dotnet build $Project -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw 'dotnet build failed' }
}
finally {
    Pop-Location
}

if (-not (Test-Path $SourceExe)) {
    throw "Expected build output at $SourceExe"
}

New-Item -ItemType Directory -Force -Path $BinaryDir | Out-Null
$Dest = Join-Path $BinaryDir $DestName
Copy-Item -Force $SourceExe $Dest
Write-Host "Copied to $Dest"