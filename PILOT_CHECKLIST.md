# FARO — Checklist de cierre funcional y piloto

Usa esta lista en orden. Marca cada ítem al completarlo en Supabase remoto y en Vercel.

## Fase A — Base de datos (Supabase SQL Editor)

Ejecutar **en este orden** (copiar cada archivo de `supabase/migrations/`):

| # | Migración | Qué habilita |
|---|-----------|--------------|
| 1 | `20260630260000_phase9_auth_roles_access.sql` | Roles, perfiles, solicitudes coordinador |
| 2 | `20260630261000_promote_user_role.sql` | Promover admin (`promote_user_role`) |
| 3 | `20260630262000_admin_notifications.sql` | Campanita admin |
| 4 | `20260630263000_coordinator_info_request.sql` | Pedir info en solicitudes |
| 5 | `20260630264000_coordinator_decision_notifications.sql` | Notificar aprobado/rechazado |
| 6 | `20260630270000_security_hardening.sql` | **Hardening obligatorio pre-piloto** |
| 7 | `20260702280000_center_extended_fields.sql` | Campos extendidos de centros |
| 8 | `20260702290000_guide_feedback_notifications.sql` | Contacto Centro de Recursos |
| 9 | `20260703180000_user_signup_notifications_and_promotions.sql` | Registro + `assign_coordinator_role` |
| 10 | `20260703190000_profile_realtime_sync.sql` | Rol coordinador sin recargar página |
| 11 | `20260703200000_notification_system.sql` | **Sistema unificado de notificaciones + push** |

Verificar funciones:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('promote_user_role', 'assign_coordinator_role', 'approve_coordinator_request');
```

Debe devolver **3 filas**.

## Fase B — Bootstrap (arranque operativo)

- [ ] Tienes al menos **1 super_admin** activo (tu cuenta)
- [ ] Registraste al menos **1 centro** (hospital, refugio o acopio)
- [ ] Variables en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] (Push) `VITE_ONESIGNAL_APP_ID` + Edge Function `send-notification-push` desplegada
- [ ] (Recomendado) `VITE_TURNSTILE_SITE_KEY` + Turnstile activo en Supabase Auth

## Fase C — Smoke test por rol

### Ciudadano (sin login)
- [ ] Mapa carga centros
- [ ] Enviar reporte sobre un centro
- [ ] Centro de Recursos abre y contacto funciona

### Ciudadano registrado
- [ ] Registro → super_admin recibe campanita "Nuevo usuario"
- [ ] Solicitar coordinador → wizard 3 pasos (sin pantalla "aprobado" fantasma)

### Coordinador (aprobado)
- [ ] Tras aprobación, **Mi Centro** aparece sin recargar (realtime)
- [ ] Registrar necesidad
- [ ] Aprobar/rechazar reporte ciudadano

### Admin regional / super_admin
- [ ] Crear centro (wizard 4 pasos)
- [ ] **Editar centro** desde detalle del mapa → "Editar centro"
- [ ] Aprobar solicitud de coordinador
- [ ] Promover usuario a admin o coordinador (Sistema)

## Fase D — Seguridad (después de Fase C)

Ver `SECURITY_REPORT.md`. Mínimo antes de piloto abierto:

- [ ] Hardening aplicado y probado
- [ ] Turnstile activo en producción
- [ ] Fix escalada de rol (`profiles_update_own`)
- [ ] Fix auto-asignación coordinador
- [ ] Prueba de abuso controlado (spam reportes)

## Fase E — Piloto controlado

- [ ] 1 super_admin + 1 admin regional (opcional) + 2–3 coordinadores + 5–10 ciudadanos
- [ ] 3–5 centros reales registrados
- [ ] Canal de soporte definido (WhatsApp / correo en Recursos)

---

**Estado actual del código:** Fases A (archivos listos) y funcionalidad de edición de centros + sync de rol implementadas en frontend. Falta **aplicar migraciones en Supabase remoto** (Fase A).
