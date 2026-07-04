# OneSignal + Supabase — configuración rápida

Tu `.env` local ya tiene `VITE_ONESIGNAL_APP_ID`. La **REST API Key** no debe ir en el repo.

## 1. Secretos en Supabase (Dashboard)

1. Abre [Supabase Dashboard](https://supabase.com/dashboard) → proyecto **gfngmbbotqzzchjzgajo**
2. **Edge Functions** → **Secrets** (o Project Settings → Edge Functions)
3. Añade:

| Nombre | Valor |
|--------|--------|
| `ONESIGNAL_APP_ID` | `6a70fa65-c94b-4a32-bbe4-eec31985bead` |
| `ONESIGNAL_REST_API_KEY` | La clave `os_v2_app_...` que generaste (solo una vez) |

## 2. Desplegar Edge Function

### Opción A — Terminal (después de `supabase login`)

```powershell
$env:ONESIGNAL_REST_API_KEY = "os_v2_app_..."
.\scripts\setup-onesignal-supabase.ps1
```

### Opción B — Dashboard / CLI manual

```bash
npx supabase login
npx supabase secrets set ONESIGNAL_APP_ID=6a70fa65-c94b-4a32-bbe4-eec31985bead ONESIGNAL_REST_API_KEY=TU_CLAVE --project-ref gfngmbbotqzzchjzgajo
npx supabase functions deploy send-notification-push --project-ref gfngmbbotqzzchjzgajo --no-verify-jwt
```

## 3. Database Webhook

**Database** → **Webhooks** → **Create a new hook**

| Campo | Valor |
|-------|--------|
| Name | `notify-push-on-insert` |
| Table | `notifications` |
| Events | Insert |
| Type | Supabase Edge Function |
| Function | `send-notification-push` |

(O URL: `https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push`)

## 4. Vercel (producción)

Variable de entorno:

```
VITE_ONESIGNAL_APP_ID=6a70fa65-c94b-4a32-bbe4-eec31985bead
```

Redeploy después de añadirla.

## 5. OneSignal Dashboard

**Settings → Platforms → Web**

- Site URL: tu dominio Vercel
- Service Worker: `/OneSignalSDKWorker.js`

## Seguridad

- **No pegues la REST API Key en GitHub, `.env` ni en el chat.**
- Como la compartiste en texto plano, considera **rotar la clave** en OneSignal después de configurar Supabase (generar nueva y actualizar el secreto).

## Probar

1. Migración `20260703200000_notification_system.sql` aplicada
2. Login → Perfil → Preferencias → activar push
3. Disparar evento (ej. registro) → campana + push en dispositivo
