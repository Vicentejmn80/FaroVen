#Requires -Version 5.1
<#
.SYNOPSIS
  Aplica una migración SQL al proyecto remoto FARO vía Supabase Management API.

.USAGE
  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
  .\scripts\apply-migration-remote.ps1 -MigrationFile "supabase/migrations/20260715100000_set_user_role_and_intent.sql"

.NOTES
  Token: https://supabase.com/dashboard/account/tokens (scope database_write)
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$MigrationFile,

  [string]$ProjectRef = "gfngmbbotqzzchjzgajo"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $env:SUPABASE_ACCESS_TOKEN -or $env:SUPABASE_ACCESS_TOKEN.Trim().Length -eq 0) {
  throw "SUPABASE_ACCESS_TOKEN no está definido. Genera uno en https://supabase.com/dashboard/account/tokens"
}

$fullPath = Join-Path $RepoRoot $MigrationFile
if (-not (Test-Path $fullPath)) {
  throw "No se encontró el archivo: $MigrationFile"
}

$sql = Get-Content -Path $fullPath -Raw -Encoding UTF8
$version = [System.IO.Path]::GetFileNameWithoutExtension($MigrationFile)

Write-Host "Aplicando migración: $version" -ForegroundColor Cyan

$headers = @{
  Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN.Trim())"
  Accept        = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json -Compress
$uri = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"

try {
  $response = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -ContentType "application/json" -Body $body
  Write-Host "OK  SQL ejecutado correctamente." -ForegroundColor Green
  if ($response) {
    $response | ConvertTo-Json -Depth 4
  }
}
catch {
  $detail = $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    $detail = $_.ErrorDetails.Message
  }
  throw "Falló la migración: $detail"
}

# Registrar versión en schema_migrations (idempotente)
$recordSql = @"
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('$version')
ON CONFLICT (version) DO NOTHING;
"@

$recordBody = @{ query = $recordSql } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -ContentType "application/json" -Body $recordBody | Out-Null
  Write-Host "OK  Versión registrada en schema_migrations." -ForegroundColor Green
}
catch {
  Write-Host "WARN No se pudo registrar en schema_migrations (puede que ya exista)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Verificación sugerida (SQL Editor):" -ForegroundColor Cyan
Write-Host @"
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'participation_intent';

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('set_user_role', 'set_participation_intent', 'list_all_profiles');
"@
