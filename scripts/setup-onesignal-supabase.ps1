# Configura secretos OneSignal en Supabase y despliega send-notification-push.
# NO guardes la REST API Key en este archivo. Pásala solo por variable de entorno.
#
# Uso (PowerShell):
#   $env:ONESIGNAL_REST_API_KEY = "os_v2_app_..."
#   .\scripts\setup-onesignal-supabase.ps1
#
# Requiere: supabase login (una vez) o SUPABASE_ACCESS_TOKEN en el entorno.

$ErrorActionPreference = "Stop"
$ProjectRef = "gfngmbbotqzzchjzgajo"
$AppId = "6a70fa65-c94b-4a32-bbe4-eec31985bead"

if (-not $env:ONESIGNAL_REST_API_KEY) {
  Write-Host "ERROR: Define ONESIGNAL_REST_API_KEY antes de ejecutar." -ForegroundColor Red
  Write-Host '  $env:ONESIGNAL_REST_API_KEY = "os_v2_app_..."'
  exit 1
}

$SupabaseCmd = "npx --yes supabase@2.109.0"

Write-Host "Configurando secretos en Supabase ($ProjectRef)..." -ForegroundColor Cyan
& cmd /c "$SupabaseCmd secrets set ONESIGNAL_APP_ID=$AppId ONESIGNAL_REST_API_KEY=$env:ONESIGNAL_REST_API_KEY --project-ref $ProjectRef"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Desplegando Edge Function send-notification-push..." -ForegroundColor Cyan
& cmd /c "$SupabaseCmd functions deploy send-notification-push --project-ref $ProjectRef --no-verify-jwt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Listo. Configura el Database Webhook en Supabase Dashboard:" -ForegroundColor Green
Write-Host "  Tabla: notifications | Evento: INSERT"
Write-Host "  URL: https://$ProjectRef.supabase.co/functions/v1/send-notification-push"
