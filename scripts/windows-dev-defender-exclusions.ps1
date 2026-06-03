#Requires -RunAsAdministrator
<#
  Adds Windows Defender exclusions for Mashed Games Studio dev work.
  Run once from an elevated PowerShell:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\scripts\windows-dev-defender-exclusions.ps1

  To remove later: Windows Security → Virus & threat protection → Manage settings → Exclusions
#>
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localCache = Join-Path $env:LOCALAPPDATA "MashedGamesStudio"
$pnpmStore = Join-Path $env:LOCALAPPDATA "pnpm\store"

$paths = @($repoRoot, $localCache)
if (Test-Path $pnpmStore) {
  $paths += $pnpmStore
}

Write-Host "Adding Defender path exclusions:"
foreach ($p in $paths) {
  Write-Host "  $p"
  Add-MpPreference -ExclusionPath $p
}

Write-Host ""
Write-Host "Done. Restart pnpm dev if it was running."
