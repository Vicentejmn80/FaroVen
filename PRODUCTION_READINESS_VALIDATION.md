# FARO — Production Readiness Validation

Fecha: 2026-07-05  
Alcance: Infraestructura, seguridad (C-01..C-05, A-01..A-12), regresión funcional, launch readiness.

## 1) Infraestructura

### Migraciones de seguridad en repositorio
Presentes en `supabase/migrations/`:
- `20260705001000_security_p0_critical_fixes.sql`
- `20260705002000_harden_notify_coordinator_rpc.sql`
- `20260705010000_fix_is_admin_email_bypass.sql`
- `20260705011000_harden_persons_public_read.sql`
- `20260705012000_lockdown_events_insert.sql`
- `20260705013000_harden_storage_public_buckets.sql`
- `20260705014000_lockdown_coordinator_requests_update.sql`
- `20260705015000_harden_rate_limit_actor_ip.sql`
- `20260705016000_validate_assigned_site_on_approve.sql`
- `20260705017000_unique_active_coordinator_per_site.sql`
- `20260705018000_preserve_admin_role_on_approve.sql`
- `20260705019000_disable_profile_realtime.sql`
- `20260705020000_validate_need_write_ownership.sql`
- `20260705021000_restore_admin_insert_status_active.sql`

### Edge Functions desplegadas (evidencia runtime)
- Endpoint probado: `POST /functions/v1/send-notification-push`
- Resultado obtenido sin secret: `HTTP 200 {"skipped":true,"reason":"push_disabled"}`
- Resultado esperado con hardening C-03: `401 unauthorized` o `500 server_not_configured`
- Conclusión: el entorno desplegado **no refleja** el hardening esperado de C-03.

### Variables de entorno críticas
- Local/repo: existe referencia a `PUSH_WEBHOOK_SECRET` en código de función.
- Runtime: comportamiento indica que la validación de secret no está activa en despliegue actual.

### Storage / RLS / Realtime
- Verificación completa de estado desplegado de publicaciones Realtime, policies y buckets requiere acceso SQL admin.
- Evidencia parcial runtime: `events` insert anónimo bloqueado (`401 permission denied`), consistente con A-04 aplicado.

## 2) Validación de seguridad (17 vulnerabilidades)

| Vulnerabilidad | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| C-01 | PATCH role bloqueado | No ejecutable sin JWT usuario | Pendiente runtime |
| C-02 | INSERT coordinator_profiles bloqueado | No ejecutable sin JWT admin/user | Pendiente runtime |
| C-03 | Edge function rechaza sin secret | `200 skipped` sin secret | **FAIL** |
| C-04 | RPC notify bloqueada | `409 FK` (función ejecutó) con token anon | **FAIL** |
| C-05 | RPC log_auth_event bloqueada | `409 FK` (función ejecutó) con token anon | **FAIL** |
| A-01 | is_admin sin email bypass | Pendiente (requiere JWT y SQL rol) | Pendiente runtime |
| A-02 | approve valida sitio | Pendiente (RPC admin) | Pendiente runtime |
| A-03 | approve no degrada admin | Pendiente (RPC admin) | Pendiente runtime |
| A-04 | insert manual events bloqueado | `401 permission denied` | PASS |
| A-05 | persons no expuesto público | `200 []` (inconcluso sin dataset) | Pendiente runtime |
| A-06 | rate-limit no spoofable por header | Pendiente (requiere test de repetición controlado) | Pendiente runtime |
| A-07 | buckets no públicos | Pendiente (requiere verificación bucket/public + objeto real) | Pendiente runtime |
| A-08 | profiles fuera de realtime | Pendiente (verificación SQL publication) | Pendiente runtime |
| A-09 | update directo coordinator_requests bloqueado | Pendiente (JWT admin) | Pendiente runtime |
| A-10 | único coordinador activo por sitio | Pendiente (datos + constraint runtime) | Pendiente runtime |
| A-11 | need ownership enforced en trigger | Pendiente (JWT coordinador/no coordinador) | Pendiente runtime |
| A-12 | admin insert exige status=active | Pendiente (JWT admin) | Pendiente runtime |

## 3) Regresión funcional

Validación funcional completa en entorno desplegado no ejecutable sin credenciales y cuentas de prueba operativas.

Cobertura parcial verificada:
- `events` no acepta insert anónimo (A-04 PASS runtime parcial).
- Edge push endpoint sigue accesible sin secret (regresión de seguridad crítica).

Flujos pendientes de prueba end-to-end:
- Login, registro, recuperación
- Solicitud/aprobación/rechazo coordinador
- Reportes/personas/needs/inventario
- Notificaciones y push
- Upload storage
- Realtime sincronización de roles

## 4) Observabilidad

Evidencia técnica recogida vía HTTP:
- `send-notification-push` responde 200 sin secret.
- RPCs `notify_coordinator_request_user` y `log_auth_event` ejecutables con token anon (error de FK, no permission denied).
- Inserción directa en `events` anónima bloqueada por permisos.

## 5) Riesgos residuales

Críticos abiertos en runtime:
1. **C-03 abierto**: endpoint push aceptando requests sin secret.
2. **C-04 abierto**: RPC notify ejecutable sin bloqueo de permisos efectivo.
3. **C-05 abierto**: RPC log_auth_event ejecutable sin bloqueo de permisos efectivo.

Riesgo operativo:
- Envío/forja de notificaciones y contaminación de auditoría.
- No apto para producción con actores maliciosos.

## 6) Checklist pendiente

- [ ] Confirmar/aplicar migraciones en Supabase remoto (`supabase_migrations.schema_migrations`).
- [ ] Verificar grants reales en runtime para `notify_coordinator_request_user` y `log_auth_event` (incluyendo `PUBLIC/anon/authenticated`).
- [ ] Desplegar Edge Function `send-notification-push` versión con validación obligatoria de `x-faro-webhook-secret`.
- [ ] Configurar `PUSH_WEBHOOK_SECRET` en entorno de funciones y webhook.
- [ ] Ejecutar batería completa de 17 exploits con JWTs de prueba (normal/coordinador/admin).
- [ ] Ejecutar regresión funcional E2E de módulos críticos.

## 7) Recomendación final

## **NO GO**

Justificación técnica:
- Se demostraron vulnerabilidades reales abiertas en runtime (C-03, C-04, C-05) mediante exploits HTTP directos.
- No existe evidencia completa de aplicación efectiva de migraciones en entorno desplegado.
- Falta validación funcional integral post-hardening.
