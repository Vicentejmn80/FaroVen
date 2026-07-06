#Requires -Version 5.1
<#
.SYNOPSIS
  Configura secretos Edge y webhook de push en Supabase vía Management API (sin CLI).

.DESCRIPTION
  1. Solicita SUPABASE_ACCESS_TOKEN
  2. Genera PUSH_WEBHOOK_SECRET
  3. POST /v1/projects/{ref}/secrets
  4. Habilita Database Webhooks (si aplica)
  5. Crea/actualiza trigger HTTP en public.notifications (equivalente al Dashboard)
  6. Ejecuta verify-post-remediation.mjs

  NOTA: La Management API NO expone PATCH /database/webhooks/{id}.
        El webhook se configura con SQL (supabase_functions.http_request).

.HOW TO GET SUPABASE_ACCESS_TOKEN
  1. Abre https://supabase.com/dashboard/account/tokens
  2. Click "Generate new token"
  3. Nombre sugerido: "FARO runtime auto-fix"
  4. Scopes mínimos:
       - edge_functions_secrets_write  (secretos Edge)
       - database_write                (SQL / webhook trigger)
       - database_webhooks_config_write (habilitar webhooks)
  5. Copia el token (solo se muestra una vez)

.USAGE
  cd C:\Users\Vicente\Documents\FaroVen
  .\scripts\runtime-remediation\auto-fix.ps1

  Opcional antes de ejecutar (push real a OneSignal):
  $env:ONESIGNAL_REST_API_KEY = "os_v2_app_..."

  Opcional para checks SQL del verify script:
  $env:DATABASE_URL = "postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres"
#>

$ErrorActionPreference = "Stop"

$ProjectRef = "gfngmbbotqzzchjzgajo"
$ApiBase = "https://api.supabase.com/v1"
$OneSignalAppId = "6a70fa65-c94b-4a32-bbe4-eec31985bead"
$EdgePushUrl = "https://$ProjectRef.supabase.co/functions/v1/send-notification-push"
$WebhookTriggerName = "faro_push_notification_insert"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  Write-Host "FAIL $Message" -ForegroundColor Red
}

function Escape-SqlLiteral([string]$Value) {
  return ($Value -replace "'", "''")
}

function Escape-JsonString([string]$Value) {
  return ($Value `
    -replace '\\', '\\' `
    -replace '"', '\"' `
    -replace "`r", '\r' `
    -replace "`n", '\n' `
    -replace "`t", '\t')
}

function Get-AccessToken {
  if ($env:SUPABASE_ACCESS_TOKEN -and $env:SUPABASE_ACCESS_TOKEN.Trim().Length -gt 0) {
    Write-Warn "Usando SUPABASE_ACCESS_TOKEN desde variable de entorno."
    return $env:SUPABASE_ACCESS_TOKEN.Trim()
  }

  Write-Host ""
  Write-Host "Obtén tu token en: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
  Write-Host "Scopes: edge_functions_secrets_write, database_write, database_webhooks_config_write" -ForegroundColor Yellow
  $secure = Read-Host "Pega SUPABASE_ACCESS_TOKEN" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Invoke-SupabaseApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null
  )

  $uri = "$ApiBase$Path"
  $headers = @{
    Authorization = "Bearer $script:AccessToken"
    Accept        = "application/json"
  }

  $params = @{
    Method      = $Method
    Uri         = $uri
    Headers     = $headers
    ContentType = "application/json"
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }

  try {
    return Invoke-RestMethod @params
  }
  catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $detail = $_.ErrorDetails.Message
    }
    throw "Supabase API $Method $Path failed: $detail"
  }
}

function Invoke-SupabaseSql([string]$Query) {
  return Invoke-SupabaseApi -Method POST -Path "/projects/$ProjectRef/database/query" -Body @{ query = $Query }
}

function Invoke-HttpPostStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][hashtable]$Headers,
    [Parameter(Mandatory = $true)][string]$Body
  )

  try {
    $response = Invoke-WebRequest -Method POST -Uri $Uri -Headers $Headers -Body $Body -UseBasicParsing
    return [int]$response.StatusCode
  }
  catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode.value__
    }
    throw
  }
}

Set-Location $RepoRoot

Write-Step "Inicio auto-fix FARO ($ProjectRef)"
$script:AccessToken = Get-AccessToken

# ---------------------------------------------------------------------------
# 1) Generar secreto
# ---------------------------------------------------------------------------
Write-Step "Generando PUSH_WEBHOOK_SECRET"
$WebhookSecret = "FaroSecret2026_" + [Guid]::NewGuid().ToString("N")
Write-Ok "Secreto generado (guárdalo en tu gestor de contraseñas; no se commitea)."

# ---------------------------------------------------------------------------
# 2) POST /secrets
# ---------------------------------------------------------------------------
Write-Step "Configurando secretos Edge via POST /v1/projects/$ProjectRef/secrets"
$secretsBody = @(
  @{ name = "PUSH_WEBHOOK_SECRET"; value = $WebhookSecret },
  @{ name = "ONESIGNAL_APP_ID"; value = $OneSignalAppId }
)

if ($env:ONESIGNAL_REST_API_KEY -and $env:ONESIGNAL_REST_API_KEY.Trim().Length -gt 0) {
  $secretsBody += @{ name = "ONESIGNAL_REST_API_KEY"; value = $env:ONESIGNAL_REST_API_KEY.Trim() }
  Write-Ok "ONESIGNAL_REST_API_KEY incluido desde variable de entorno."
}
else {
  Write-Warn "ONESIGNAL_REST_API_KEY no definido. Push real puede quedar en 'no_subscriptions' hasta configurarlo."
}

Invoke-SupabaseApi -Method POST -Path "/projects/$ProjectRef/secrets" -Body $secretsBody | Out-Null
Write-Ok "Secretos enviados a Edge Functions."
Write-Warn "Esperando 15s para propagación de secretos Edge..."
Start-Sleep -Seconds 15

# ---------------------------------------------------------------------------
# 3) Habilitar Database Webhooks feature
# ---------------------------------------------------------------------------
Write-Step "Habilitando Database Webhooks (POST .../database/webhooks/enable)"
try {
  Invoke-SupabaseApi -Method POST -Path "/projects/$ProjectRef/database/webhooks/enable" | Out-Null
  Write-Ok "Database Webhooks habilitado (o ya estaba activo)."
}
catch {
  Write-Warn "No se pudo habilitar webhooks (puede estar ya habilitado): $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# 4) Webhook trigger (no existe PATCH en Management API)
# ---------------------------------------------------------------------------
Write-Step "Configurando webhook INSERT en public.notifications via SQL"
Write-Warn "Management API no tiene PATCH /database/webhooks/{id}; se usa database/query."

$headersJson = '{"Content-Type":"application/json","x-faro-webhook-secret":"' + (Escape-JsonString $WebhookSecret) + '"}'
$headersSql = Escape-SqlLiteral $headersJson
$urlSql = Escape-SqlLiteral $EdgePushUrl

$webhookSql = @"
DROP TRIGGER IF EXISTS "$WebhookTriggerName" ON public.notifications;

CREATE TRIGGER "$WebhookTriggerName"
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.push_sent IS DISTINCT FROM true)
  EXECUTE FUNCTION supabase_functions.http_request(
    '$urlSql',
    'POST',
    '$headersSql',
    '{}',
    '5000'
  );
"@

Invoke-SupabaseSql $webhookSql | Out-Null
Write-Ok "Trigger '$WebhookTriggerName' creado con header x-faro-webhook-secret."

# Verificar trigger presente
$checkSql = @"
SELECT tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'notifications'
  AND NOT t.tgisinternal
  AND tgname = '$WebhookTriggerName';
"@
$triggerCheck = Invoke-SupabaseSql $checkSql
if ($triggerCheck) {
  Write-Ok "Trigger verificado en runtime."
}
else {
  Write-Warn "No se pudo confirmar el trigger via API response; revisa SQL Editor si push no dispara."
}

# ---------------------------------------------------------------------------
# 5) Verificación HTTP rápida (anon)
# ---------------------------------------------------------------------------
Write-Step "Verificación HTTP rápida Edge + RPC anon"

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -le 0) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    if (-not (Get-Item -Path "Env:$k" -ErrorAction SilentlyContinue)) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

Load-DotEnv (Join-Path $RepoRoot ".env")
Load-DotEnv (Join-Path $RepoRoot "frontend\.env")

$anonKey = $env:SUPABASE_ANON_KEY
if (-not $anonKey) { $anonKey = $env:VITE_SUPABASE_ANON_KEY }
$supabaseUrl = $env:SUPABASE_URL
if (-not $supabaseUrl) { $supabaseUrl = $env:VITE_SUPABASE_URL }

if ($anonKey -and $supabaseUrl) {
  $headers = @{
    apikey         = $anonKey
    Authorization  = "Bearer $anonKey"
    "Content-Type" = "application/json"
  }
  $edgeUri = "$supabaseUrl/functions/v1/send-notification-push"
  $edgeBody = '{"notification_id":"00000000-0000-0000-0000-000000000000"}'

  $noSecretStatus = Invoke-HttpPostStatus -Uri $edgeUri -Headers $headers -Body $edgeBody
  if ($noSecretStatus -eq 401) { Write-Ok "Edge sin secret -> 401" } else { Write-Fail "Edge sin secret -> $noSecretStatus" }

  $badHeaders = @{}
  foreach ($key in $headers.Keys) { $badHeaders[$key] = $headers[$key] }
  $badHeaders["x-faro-webhook-secret"] = "invalid-secret"
  $badSecretStatus = Invoke-HttpPostStatus -Uri $edgeUri -Headers $badHeaders -Body $edgeBody
  if ($badSecretStatus -eq 401) { Write-Ok "Edge secret inválido -> 401" } else { Write-Fail "Edge secret inválido -> $badSecretStatus" }
}
else {
  Write-Warn "No se encontró SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY en .env para smoke HTTP."
}

# ---------------------------------------------------------------------------
# 6) Ejecutar verify-post-remediation.mjs
# ---------------------------------------------------------------------------
Write-Step "Ejecutando node scripts/runtime-remediation/verify-post-remediation.mjs"

if (-not $env:DATABASE_URL) {
  Write-Warn "DATABASE_URL no definido: checks SQL c-i del verify script fallarán."
  Write-Warn "Opcional: `$env:DATABASE_URL = 'postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres'"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js no encontrado en PATH."
}

$verifyPath = Join-Path $RepoRoot "scripts\runtime-remediation\verify-post-remediation.mjs"
if (-not (Test-Path $verifyPath)) {
  throw "No existe $verifyPath"
}

Write-Host ""
Write-Host "Secreto generado (copia a vault interno):" -ForegroundColor Yellow
Write-Host "PUSH_WEBHOOK_SECRET=$WebhookSecret" -ForegroundColor Yellow
Write-Host ""

& node $verifyPath
$verifyExit = $LASTEXITCODE

Write-Host ""
if ($verifyExit -eq 0) {
  Write-Ok "Auto-fix completado. verify-post-remediation: PASS"
}
else {
  Write-Fail "Auto-fix terminó con verify FAIL (exit $verifyExit)."
  if (-not $env:DATABASE_URL) {
    Write-Warn "Define DATABASE_URL y ejecuta: npm install pg; node scripts/runtime-remediation/verify-post-remediation.mjs"
  }
  exit $verifyExit
}
