# RUNTIME_REMEDIATION_PLAN

**Proyecto:** FARO (`gfngmbbotqzzchjzgajo`)  
**Fecha:** 2026-07-05  
**Rol:** Staff Security Engineer — remediación runtime (repo correcto, Supabase desalineado)  
**Prioridad:** Seguridad > Integridad > Disponibilidad

---

## Resumen ejecutivo

El runtime remoto no refleja migraciones y despliegues del repositorio. Este plan sincroniza **solo runtime** en cuatro fases:

| Fase | Alcance | Issues |
|---|---|---|
| 0 | Pre-check + backup | — |
| 1 (P0) | Edge + grants RPC críticos | T-011, T-012, T-014, T-015, T-045 |
| 2 (P1) | Migraciones DB pendientes | T-018, T-021, T-022, T-024, T-025, T-026 |
| 3 (P2) | Limpieza datos huérfanos | T-038 |
| 4 | Verificación + build | Cierre de certificación |

**Archivos de apoyo:**

- `supabase/migrations/20260705022000_runtime_revoke_anon_critical_rpcs.sql` — única migración nueva (estrictamente necesaria: REVOKE `anon`/`PUBLIC`)
- `scripts/runtime-remediation/cleanup_orphan_coordinators.sql`
- `scripts/runtime-remediation/verify-post-remediation.mjs`

**FALSE POSITIVES ignorados:** T-002, T-004, T-005, T-010, T-041, T-042

---

## Pre-requisitos

1. Acceso admin al proyecto Supabase (`gfngmbbotqzzchjzgajo`)
2. Supabase CLI autenticada (`npx supabase login`)
3. Variables en shell (nunca commitear):
   - `SUPABASE_ACCESS_TOKEN` (o login interactivo)
   - `PUSH_WEBHOOK_SECRET` (generar valor aleatorio ≥32 chars)
   - `ONESIGNAL_REST_API_KEY` (solo si se reconfigura push)
4. Ventana de mantenimiento recomendada: 15–30 min
5. Rollback general: snapshot/backup DB antes de Fase 2

---

## FASE 0 — Pre-check (orden 0)

### 0.1 Confirmar proyecto linkado

```powershell
cd C:\Users\Vicente\Documents\FaroVen
npx --yes supabase@2.109.0 link --project-ref gfngmbbotqzzchjzgajo
```

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Bajo — solo vincula CLI |
| **Verificación** | `npx supabase projects list` muestra `gfngmbbotqzzchjzgajo` linked |
| **Rollback** | `npx supabase unlink` |

### 0.2 Snapshot de estado actual (evidencia)

```powershell
node scripts/runtime-remediation/verify-post-remediation.mjs --baseline
```

Guardar salida en un archivo local (fuera del repo) para comparación post-remediación.

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Ninguno — solo lectura |
| **Verificación** | Script termina con resumen de checks FAIL esperados |
| **Rollback** | N/A |

### 0.3 Backup manual (obligatorio antes de Fase 2)

En Supabase Dashboard → **Database → Backups** → confirmar backup reciente o crear uno.

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Ninguno |
| **Verificación** | Backup timestamp < 24h |
| **Rollback** | Restore desde Dashboard si Fase 2 falla |

---

## FASE 1 (P0) — VERIFIED VULNERABILITIES

### 1.1 T-011 / T-012 — Edge Function sin autenticación de secreto

**Relacionado:** `supabase/functions/send-notification-push/index.ts`, secret `PUSH_WEBHOOK_SECRET`

#### Paso 1 — Configurar secretos Edge (orden 1)

```powershell
$env:PUSH_WEBHOOK_SECRET = "<GENERAR-VALOR-SECRETO-LOCAL>"
$env:ONESIGNAL_REST_API_KEY = "<TU-REST-API-KEY>"
npx --yes supabase@2.109.0 secrets set `
  PUSH_WEBHOOK_SECRET=$env:PUSH_WEBHOOK_SECRET `
  ONESIGNAL_APP_ID=6a70fa65-c94b-4a32-bbe4-eec31985bead `
  ONESIGNAL_REST_API_KEY=$env:ONESIGNAL_REST_API_KEY `
  --project-ref gfngmbbotqzzchjzgajo
```

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Medio — push dejará de funcionar si webhook no envía header |
| **Verificación** | `curl -X POST https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push` sin header → **401** `unauthorized` |
| **Verificación positiva** | POST con header `x-faro-webhook-secret: <valor>` y payload válido → no 401 |
| **Rollback** | Redeploy versión anterior de función + quitar secret; o `secrets unset PUSH_WEBHOOK_SECRET` |

#### Paso 2 — Redesplegar Edge Function desde repo (orden 2)

```powershell
npx --yes supabase@2.109.0 functions deploy send-notification-push `
  --project-ref gfngmbbotqzzchjzgajo `
  --no-verify-jwt
```

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Bajo en seguridad; medio en push si secretos no configurados |
| **Verificación** | MCP/`get_edge_function` debe mostrar código con `PUSH_WEBHOOK_SECRET` y validación L45–L62 |
| **Rollback** | Redeploy commit anterior de la función desde historial Supabase |

#### Paso 3 — Actualizar Database Webhook (orden 3)

Dashboard → **Database → Webhooks** → webhook `notifications INSERT`:

- URL: `https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push`
- Header: `x-faro-webhook-secret: <mismo PUSH_WEBHOOK_SECRET>`

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Medio — push silencioso si header incorrecto |
| **Verificación** | Insert de prueba en `notifications` con `push_enabled=true` dispara edge 200/ok (no 401) |
| **Rollback** | Restaurar header anterior o deshabilitar webhook temporalmente |

---

### 1.2 T-014 / T-015 / T-045 — RPCs críticas ejecutables por anon

**Relacionado:** `20260705001000`, `20260705002000`, nueva `20260705022000_runtime_revoke_anon_critical_rpcs.sql`

Las migraciones existentes revocan solo `authenticated`. PostgreSQL concede `EXECUTE` a `PUBLIC` por defecto; `anon` sigue pudiendo invocar vía PostgREST.

#### Paso 4 — Aplicar REVOKE anon/PUBLIC (orden 4)

**Opción A (recomendada — vía migración):**

```powershell
npx --yes supabase@2.109.0 db push --project-ref gfngmbbotqzzchjzgajo
```

Esto aplica todas las migraciones pendientes incluyendo `20260705022000`.

**Opción B (SQL Editor — solo este fix P0 si Fase 2 se pospone):**

Ejecutar contenido de `supabase/migrations/20260705022000_runtime_revoke_anon_critical_rpcs.sql` en SQL Editor.

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Bajo — RPCs internas SECURITY DEFINER siguen llamándolas como owner |
| **Verificación SQL** | `SELECT has_function_privilege('anon','public.log_auth_event(text,uuid,jsonb)','EXECUTE');` → **false** |
| **Verificación SQL** | `SELECT has_function_privilege('anon','public.notify_coordinator_request_user(uuid,text,text,text,jsonb,uuid)','EXECUTE');` → **false** |
| **Verificación HTTP** | POST anon a ambas RPC → **401/403** (no 409 FK) |
| **Rollback** | `GRANT EXECUTE ON FUNCTION ... TO authenticated;` solo si flujos admin legítimos se rompen (revisar manualmente) |

> **Revisión manual obligatoria (regla del proyecto):** antes del Paso 4, revisar en SQL Editor las definiciones actuales de `notify_coordinator_request_user` y `log_auth_event`. No tocar policies en esta acción.

---

## FASE 2 (P1) — DEPLOYMENT ISSUES (migraciones repo pendientes en runtime)

Aplicar en bloque vía `db push` (orden 5). Migraciones objetivo:

| Issue | Migración repo |
|---|---|
| T-018 A-05 | `20260705011000_harden_persons_public_read.sql` |
| T-021/T-022 A-08 | `20260705019000_disable_profile_realtime.sql` |
| T-024 A-10 | `20260705017000_unique_active_coordinator_per_site.sql` |
| T-025 A-11 | `20260705020000_validate_need_write_ownership.sql` |
| T-026 A-12 | `20260705021000_restore_admin_insert_status_active.sql` |

#### Paso 5 — Push migraciones (orden 5)

```powershell
npx --yes supabase@2.109.0 db push --project-ref gfngmbbotqzzchjzgajo
```

| Acción | Riesgo | Verificación | Rollback |
|---|---|---|---|
| **T-018** DROP `public_read_persons` | Medio — coordinadores deben seguir leyendo vía `coordinator_read_persons` | `SELECT EXISTS(... policyname='public_read_persons')` → false; `coordinator_read_persons` → true | Re-aplicar policy antigua desde backup SQL (solo emergencia) |
| **T-021/T-022** DROP realtime profiles | Bajo en seguridad; medio en UX — rol ya no sync en vivo | `pg_publication_tables` sin `profiles`/`coordinator_profiles` | `ALTER PUBLICATION supabase_realtime ADD TABLE ...` |
| **T-024** UNIQUE INDEX | **Alto** si existen duplicados activos | Índice `coordinator_profiles_site_unique` existe | `DROP INDEX coordinator_profiles_site_unique` |
| **T-025** ownership trigger | Medio — writes needs sin ownership fallarán | `strpos(pg_get_functiondef(...),'invalid_need_owner')>0` | Restaurar definición anterior de `validate_need_write()` desde backup |
| **T-026** status active policy | Bajo | `with_check` contiene `status = 'active'` | Restaurar policy anterior |

#### Paso 5b — Pre-check duplicados antes de índice (T-024)

**Ejecutar en SQL Editor antes de `db push` si hay duda:**

```sql
SELECT site_type, site_id, count(*) AS active_coords
FROM coordinator_profiles
WHERE onboarding_complete = true
GROUP BY site_type, site_id
HAVING count(*) > 1;
```

Si devuelve filas → resolver duplicados manualmente **antes** de aplicar `20260705017000` (ver Fase 3).

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Alto si hay duplicados — migración fallará o bloqueará aprobaciones |
| **Verificación** | Query devuelve 0 filas |
| **Rollback** | Limpiar duplicados según criterio de negocio |

> **Revisión manual obligatoria:** revisar policies de `persons` en Dashboard antes de confirmar push (regla del proyecto).

---

## FASE 3 (P2) — CONFIGURATION ISSUE (T-038)

**Relacionado:** `coordinator_profiles` huérfanos → FK en `notify_on_citizen_report`

#### Paso 6 — Inventario de huérfanos (orden 6)

```powershell
# Ejecutar en SQL Editor el bloque SELECT de:
# scripts/runtime-remediation/cleanup_orphan_coordinators.sql
```

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Ninguno — solo lectura |
| **Verificación** | Lista de filas con `in_auth_users=false` |
| **Rollback** | N/A |

#### Paso 7 — Limpieza (orden 7)

Ejecutar bloque DELETE de `scripts/runtime-remediation/cleanup_orphan_coordinators.sql` **solo tras revisión manual** de la lista.

| Campo | Valor |
|---|---|
| **Riesgo de regresión** | Medio — elimina perfiles coordinador inválidos |
| **Verificación** | Query huérfanos → 0 filas |
| **Verificación funcional** | POST anon reporte con site válido → **201/200** (no 409 FK) |
| **Rollback** | Restaurar filas desde backup DB (no recrear manualmente sin auth.users) |

---

## FASE 4 — Validación final

### Paso 8 — Verificación automatizada (orden 8)

```powershell
node scripts/runtime-remediation/verify-post-remediation.mjs
```

Criterio: **0 FAIL** en checks P0/P1/P2.

### Paso 9 — Build frontend (orden 9)

```powershell
cd C:\Users\Vicente\Documents\FaroVen
npm run build
cd frontend
npm run build
```

Criterio: exit code 0 (sin errores TypeScript/Vite).

### Paso 10 — Confirmación seguridad anon (orden 10)

El script de verificación debe reportar:

- Edge sin secret → 401
- Edge secret inválido → 401
- RPC `notify_coordinator_request_user` anon → denied
- RPC `log_auth_event` anon → denied
- `public_read_persons` → absent
- Realtime profiles → absent from publication

---

## Matriz de riesgos consolidada

| Orden | Acción | Prioridad | Riesgo | Impacto si falla | Mitigación |
|---|---|---|---|---|---|
| 0 | Baseline + backup | — | Bajo | Sin rollback | Backup obligatorio |
| 1 | Secrets Edge | P0 | Medio | Push roto | Probar webhook con header antes de cerrar ventana |
| 2 | Deploy Edge | P0 | Medio | Push roto | Rollback deploy |
| 3 | Webhook header | P0 | Medio | Push roto | Documentar secret en vault interno |
| 4 | REVOKE anon RPC | P0 | Bajo | Ninguno esperado | Verificar RPC admin vía SECURITY DEFINER |
| 5 | db push P1 | P1 | Medio–Alto | Migración falla / UX rol | Pre-check duplicados; revisar policies |
| 6–7 | Cleanup huérfanos | P2 | Medio | Pérdida perfil inválido | Revisión manual lista |
| 8–10 | Verificación | — | Bajo | Falso GO | No cerrar hasta 0 FAIL P0 |

---

## Orden de ejecución (checklist)

```
[ ] 0.1 link proyecto
[ ] 0.2 baseline verify --baseline
[ ] 0.3 backup DB
[ ] 1.1 secrets set (PUSH_WEBHOOK_SECRET + OneSignal)
[ ] 1.2 deploy send-notification-push
[ ] 1.3 webhook header x-faro-webhook-secret
[ ] 1.4 db push (incluye 20260705022000 REVOKE anon)
[ ] 2.0 pre-check duplicados coordinadores
[ ] 2.1 db push (resto migraciones P1) — puede unificarse con 1.4 si una sola pasada
[ ] 3.1 inventario huérfanos
[ ] 3.2 DELETE huérfanos (manual approve)
[ ] 4.1 verify-post-remediation.mjs
[ ] 4.2 npm run build (root + frontend)
[ ] 4.3 confirmar anon bloqueado en RPCs
```

---

## Criterios GO post-remediación

| Control | Criterio |
|---|---|
| T-011/T-012 | Edge 401 sin secret; 401 con secret inválido |
| T-014/T-015/T-045 | `has_function_privilege('anon',...)=false`; HTTP denied |
| T-018 | `public_read_persons` ausente |
| T-021/T-022 | Tablas fuera de `supabase_realtime` |
| T-024 | Índice `coordinator_profiles_site_unique` presente |
| T-025 | `invalid_need_owner` en `validate_need_write` |
| T-026 | Policies con `status = 'active'` |
| T-038 | 0 huérfanos; insert reporte anon OK |
| Build | `npm run build` OK |

---

## Notas de cumplimiento

- **NO** incluir `service_role_key` en frontend ni en scripts commiteados
- **NO** commitear `PUSH_WEBHOOK_SECRET` ni `ONESIGNAL_REST_API_KEY`
- **NO** modificar policies fuera de las migraciones revisadas
- **NO** cambios directos en producción sin backup y rollback documentado
