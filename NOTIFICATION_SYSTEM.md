# FARO — Sistema Inteligente de Notificaciones (Fase 11)

Documentación de arquitectura, flujos y despliegue a producción.

## Resumen

FARO usa una **única fuente de verdad**: la tabla `public.notifications` en Supabase. Toda la app (campana, badge, preferencias) consume **`notificationService`**. El push externo (OneSignal) es un **canal de entrega** intercambiable detrás de `pushService` / `PushProvider`.

```
Eventos DB (triggers/RPC) → create_notification()
         ↓
   notifications (RLS + Realtime)
         ↓
notificationService ← hooks (TanStack Query + Realtime)
         ↓
   NotificationHub (UI)

Paralelo (opcional):
INSERT notifications → Webhook → Edge Function → OneSignal → dispositivo
                              ↓
                    push_sent = true
```

---

## Capas de abstracción

| Capa | Ruta | Responsabilidad |
|------|------|-----------------|
| **NotificationProvider** | `src/notification-provider/` | Lectura/escritura en Supabase |
| **NotificationService** | `src/notification-service/notification-service.ts` | API única para toda la app |
| **PushProvider** | `src/push-provider/` | OneSignal hoy; Firebase mañana |
| **PushService** | `src/push-service/push-service.ts` | Init SDK, login, permisos, clicks |

### Cambiar OneSignal por otro proveedor

1. Implementar `PushProvider` (ej. `firebase-push-provider.ts`).
2. Actualizar `getPushProvider()` en `src/push-provider/index.ts`.
3. Ajustar `register_push_subscription` si cambia el ID del dispositivo.
4. Actualizar Edge Function `send-notification-push`.
5. **No tocar** `NotificationHub`, hooks ni `notificationService`.

---

## Esquema SQL

Migración: `supabase/migrations/20260703200000_notification_system.sql`

### Tablas

- **`notifications`** — fuente oficial (id, user_id, title, message, type, priority, icon, read, action_url, metadata, push_sent, push_opened, expires_at)
- **`notification_preferences`** — categorías, push_enabled, muted_until
- **`push_subscriptions`** — provider + provider_player_id por dispositivo

### RLS

- Usuario solo lee/edita/elimina sus notificaciones.
- **INSERT** en `notifications` solo vía funciones `SECURITY DEFINER`.

### Realtime

Tabla en publicación `supabase_realtime`. Hook `useNotifications` invalida al recibir cambios.

---

## Deep links (`action_url`)

| action_url | Destino |
|------------|---------|
| `tab:admin:request:{uuid}` | Admin → solicitud |
| `tab:system` | Gestión usuarios |
| `tab:ops` | Mi Centro |
| `tab:ops:reports:{uuid}` | Reporte en Mi Centro |
| `tab:ops:needs` | Necesidades |
| `tab:profile:coordinator-request` | Solicitud coordinador |

Parser: `src/lib/notification-routing.ts`  
Push URL: `/?nav=tab:ops:reports:UUID`

---

## Eventos por rol

Ver triggers en la migración SQL. Incluye: registro usuario, solicitudes coordinador, reportes, necesidades, promoción admin, contacto, aprobación/rechazo coordinador.

---

## OneSignal

- `VITE_ONESIGNAL_APP_ID` en Vercel
- `public/OneSignalSDKWorker.js`
- `src/push-provider/onesignal-push-provider.ts`
- Modal de permiso **solo** tras acción explícita del usuario

## Edge Function

`supabase/functions/send-notification-push/index.ts`

Webhook Supabase: **INSERT** en `notifications` → función → OneSignal REST → `push_sent = true`.

---

## Checklist producción

- [ ] Migración `20260703200000_notification_system.sql` aplicada
- [ ] OneSignal app + `VITE_ONESIGNAL_APP_ID`
- [ ] Edge function desplegada + secrets + webhook
- [ ] Realtime activo en `notifications`
- [ ] Smoke test campana + push + deep links por rol
