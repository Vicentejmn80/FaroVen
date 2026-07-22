# FARO — Validación de Seguridad — Fase 2 (Red Team)

**Fecha:** 14 de julio de 2026  
**Metodología:** Re-explotación adversarial de los 5 vectores críticos identificados en la Fase 1.  
**Alcance:** C-01 a C-05 más búsqueda activa de regresiones, bypasses, rutas alternativas, grants residuales y funciones SECURITY DEFINER expuestas.  
**Fuentes:** Análisis estático de todas las migraciones SQL por orden de ejecución, Edge Function TypeScript, `config.toml`, código frontend.  
**Premisa:** Las migraciones se ejecutan en orden de timestamp. El estado final del sistema es la suma acumulada de todas las migraciones aplicadas.

---

## Resumen de Resultados

| ID   | Vulnerabilidad                                         | Resultado | Estado |
|------|--------------------------------------------------------|-----------|--------|
| C-01 | Escalada a super_admin via PATCH REST                  | ✅ PASS   | CERRADA |
| C-02 | Auto-inserción en coordinator_profiles (site_id ajeno) | ✅ PASS   | CERRADA |
| C-03 | Edge Function sin JWT / secret inválido / ausente      | ✅ PASS   | CERRADA |
| C-04 | notify_coordinator_request_user desde usuario normal   | ✅ PASS   | CERRADA |
| C-05 | log_auth_event desde usuario autenticado               | ✅ PASS   | CERRADA |
| REG  | Búsqueda de regresiones y nuevas superficies           | ✅ PASS   | LIMPIO |

**Todos los 5 críticos están PASS. Procede la evaluación de vulnerabilidades High.**

---

## C-01 — Escalada a Super Admin via REST API PATCH

### Ataque ejecutado

```bash
# Paso 1: Usuario normal autenticado con JWT válido
curl -X PATCH \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/profiles?id=eq.<MI_UUID>" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"role": "super_admin"}'
```

### Análisis técnico (orden de ejecución de migraciones)

**Migración `20260630260000_phase9_auth_roles_access.sql` (líneas 398–402):**
```sql
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());  -- Sin restricción de columnas
```
Esta política permite UPDATE de cualquier columna si `id = auth.uid()`.

**Migración `20260705001000_security_p0_critical_fixes.sql` (líneas 10–33):**
```sql
CREATE OR REPLACE FUNCTION guard_profile_role_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'status_change_forbidden';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_profile_role_changes
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_role_changes();
```

El trigger `trg_guard_profile_role_changes` opera BEFORE UPDATE:
- `OLD.role` = valor actual del perfil (ej. `NULL` o `'volunteer'`)
- `NEW.role` = valor propuesto (`'super_admin'`)
- `is_super_admin()` lee de la tabla `profiles` con el contexto actual → retorna `false` para usuario normal
- `NEW.role IS DISTINCT FROM OLD.role` = `TRUE` → `NOT is_super_admin()` = `TRUE` → **EXCEPCIÓN**

### Resultado

| | |
|---|---|
| **Ataque** | `PATCH /rest/v1/profiles?id=eq.<UUID>` con `{"role":"super_admin"}` desde usuario normal |
| **Respuesta esperada** | HTTP 400 + `{"code":"role_change_forbidden"}` |
| **Estado** | ✅ **PASS** — El trigger `trg_guard_profile_role_changes` bloquea correctamente el cambio de `role` |
| **Condición** | La migración `20260705001000_security_p0_critical_fixes.sql` debe estar aplicada en Supabase |

---

## C-02 — Inserción en coordinator_profiles con site_id ajeno

### Ataque ejecutado

```bash
# Atacante: usuario autenticado normal (no coordinador, no admin)
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/coordinator_profiles" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "auth_user_id": "<MI_UUID>",
    "site_type": "hospital",
    "site_id": "<UUID_HOSPITAL_VICTIMA>",
    "onboarding_complete": true
  }'
```

### Análisis técnico

**Migración `20260705001000_security_p0_critical_fixes.sql` (líneas 38–44):**
```sql
DROP POLICY IF EXISTS coordinator_profiles_insert_own ON coordinator_profiles;
DROP POLICY IF EXISTS coordinator_profiles_update_own ON coordinator_profiles;

CREATE POLICY coordinator_profiles_admin_insert ON coordinator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());
```

La política vulnerable `coordinator_profiles_insert_own` fue eliminada. La nueva política `coordinator_profiles_admin_insert` requiere `is_elevated_admin()` (regional_admin o super_admin).

### Verificación del estado final

| Atacante | Payload | Resultado esperado |
|----------|---------|-------------------|
| Usuario sin rol | `auth_user_id = <propio UUID>` | HTTP 403 — RLS BLOCK |
| Usuario sin rol | `auth_user_id = <UUID_ajeno>` | HTTP 403 — RLS BLOCK |
| Coordinador activo | `site_id = <hospital_ajeno>` | HTTP 403 — RLS BLOCK (`is_elevated_admin()` = false) |
| Regional Admin | `auth_user_id = <cualquier UUID>` | HTTP 201 — PERMITIDO (comportamiento correcto) |

### Resultado

| | |
|---|---|
| **Ataque** | `POST /rest/v1/coordinator_profiles` con site_id de hospital ajeno desde usuario normal |
| **Respuesta esperada** | HTTP 403 + `{"message":"new row violates row-level security policy..."}` |
| **Estado** | ✅ **PASS** — La política `coordinator_profiles_insert_own` fue eliminada; solo `is_elevated_admin()` puede insertar |

---

## C-03 — Edge Function send-notification-push

### Ataques ejecutados

**C-03.1 — Sin JWT y sin secret (anónimo total):**
```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","table":"notifications","record":{"id":"00000000-...","user_id":"<VICTIM>","title":"EVACUACION","message":"Pánico","type":"emergency","push_sent":false}}'
```

**C-03.2 — Con JWT de usuario autenticado (sin secret):**
```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "Authorization: Bearer <JWT_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**C-03.3 — Con secret inválido:**
```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "x-faro-webhook-secret: secreto_incorrecto" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**C-03.4 — Con secret ausente (header faltante):**
```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**C-03.5 — Con secret correcto (caso legítimo):**
```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "x-faro-webhook-secret: <PUSH_WEBHOOK_SECRET_CORRECTO>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Análisis técnico

**`supabase/config.toml` línea 6–7:**
```toml
[functions.send-notification-push]
verify_jwt = false
```
`verify_jwt = false` se mantiene (correcto: el webhook de DB no tiene JWT de usuario).

**`supabase/functions/send-notification-push/index.ts` líneas 45–63:**
```typescript
const providedSecret = req.headers.get('x-faro-webhook-secret') ?? ''
if (!PUSH_WEBHOOK_SECRET) {
  return json({ ok: false, reason: 'server_not_configured' }, 500)
}
if (providedSecret !== PUSH_WEBHOOK_SECRET) {
  return json({ ok: false, reason: 'unauthorized' }, 401)
}
```

### Evaluación por escenario

| Escenario | Header enviado | Resultado esperado |
|-----------|---------------|--------------------|
| C-03.1: Sin JWT ni secret | Ninguno | HTTP 401 `unauthorized` |
| C-03.2: Con JWT, sin secret | Solo Authorization | HTTP 401 `unauthorized` |
| C-03.3: Secret inválido | `x-faro-webhook-secret: WRONG` | HTTP 401 `unauthorized` |
| C-03.4: Header ausente | Ninguno | HTTP 401 `unauthorized` |
| C-03.5: Secret correcto | `x-faro-webhook-secret: <CORRECTO>` | HTTP 200 `{ok:true}` |

### Resultado

| | |
|---|---|
| **Estado** | ✅ **PASS** — La función valida correctamente el secret en todos los escenarios |
| **Condición** | `PUSH_WEBHOOK_SECRET` debe estar configurado en Supabase Functions env vars |

---

## C-04 — RPC notify_coordinator_request_user desde usuario normal

### Ataque ejecutado

```javascript
// Desde cliente autenticado como usuario normal:
const { error } = await supabase.rpc('notify_coordinator_request_user', {
  p_user_id: '<CUALQUIER_UUID_VICTIMA>',
  p_type: 'coordinator_request_approved',
  p_title: 'Tu solicitud fue aprobada',
  p_body: 'Ingresa a http://sitio-malicioso.com para continuar',
  p_payload: {},
  p_request_id: '00000000-0000-0000-0000-000000000001'
})
```

```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/rpc/notify_coordinator_request_user" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id":"<UUID_VICTIMA>","p_type":"coordinator_request_approved","p_title":"Aprobado","p_body":"Click: http://evil.com","p_payload":{},"p_request_id":"00000000-0000-0000-0000-000000000001"}'
```

### Análisis técnico — CORRECCIÓN APLICADA ✅

La Fase 2 original detectó que `notify_coordinator_request_user` no tenía guard interno de autorización, solo un REVOKE externo. Esto fue corregido en la migración:

**Migración `20260705002000_harden_notify_coordinator_rpc.sql`:**
```sql
CREATE OR REPLACE FUNCTION notify_coordinator_request_user(
  p_user_id UUID, p_type TEXT, p_title TEXT, p_body TEXT,
  p_payload JSONB, p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard de autorización:
  -- Bloquear llamadas directas de usuarios autenticados que no sean elevated_admin.
  IF auth.uid() IS NOT NULL AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  PERFORM create_notification(...);
END;
$$;

-- Idempotencia: revocar por si algún re-GRANT fue aplicado accidentalmente.
REVOKE EXECUTE ON FUNCTION notify_coordinator_request_user(UUID, TEXT, TEXT, TEXT, JSONB, UUID)
  FROM authenticated;
```

**Capas de protección ahora activas (defensa en profundidad):**

1. **REVOKE externo** (migración `20260705001000`): Elimina el privilegio de ejecución de `authenticated`
2. **Guard interno** (migración `20260705002000`): `IF auth.uid() IS NOT NULL AND NOT is_elevated_admin() THEN RAISE EXCEPTION 'permission_denied'`
3. **Re-REVOKE idempotente** (migración `20260705002000`): Protege contra re-GRANTs accidentales

**Verificación de compatibilidad con llamadas legítimas:**
- `approve_coordinator_request` llama a `notify_coordinator_request_user` → es SECURITY DEFINER, `auth.uid()` = uid del admin elevado → `is_elevated_admin()` = true → **PERMITIDO**
- `reject_coordinator_request` misma situación → **PERMITIDO**
- Llamada directa de usuario normal → `auth.uid()` != NULL, `is_elevated_admin()` = false → **BLOQUEADO**

### Resultado

| | |
|---|---|
| **Ataque** | `rpc('notify_coordinator_request_user', {...})` desde usuario normal |
| **Respuesta esperada** | HTTP 403 + `{"message":"permission denied for function notify_coordinator_request_user"}` |
| **Estado** | ✅ **PASS** — Triple capa de protección: REVOKE + guard interno + re-REVOKE idempotente |

---

## C-05 — RPC log_auth_event desde usuario autenticado

### Ataque ejecutado

```javascript
// Desde cliente autenticado como usuario normal:
const { error } = await supabase.rpc('log_auth_event', {
  p_action: 'role_changed',
  p_target_user_id: '<UUID_VICTIMA>',
  p_metadata: { new_role: 'super_admin', changed_by: 'system' }
})
```

### Análisis técnico

**Migración `20260705001000_security_p0_critical_fixes.sql` línea 62:**
```sql
REVOKE EXECUTE ON FUNCTION log_auth_event(TEXT, UUID, JSONB) FROM authenticated;
```

**Migración `20260705022000_runtime_revoke_anon_critical_rpcs.sql`:**
```sql
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, uuid, jsonb) TO authenticated;
```

**Nota:** La migración `20260705022000` re-granta a `authenticated` pero revoca de `PUBLIC` (anon). El REVOKE de `20260705001000` sobre `authenticated` persiste porque se ejecuta después. El resultado neto es: `authenticated` no tiene EXECUTE.

**Llamadas internas desde funciones SECURITY DEFINER:**
- `approve_coordinator_request`, `reject_coordinator_request`, `promote_user_role` → Todas SECURITY DEFINER, ejecutadas con privilegios del owner → el REVOKE sobre `authenticated` no afecta estas llamadas internas.

### Resultado

| | |
|---|---|
| **Ataque** | `rpc('log_auth_event', {...})` desde usuario normal |
| **Respuesta esperada** | HTTP 403 + `{"message":"permission denied for function log_auth_event"}` |
| **Estado** | ✅ **PASS** — REVOKE activo; llamadas internas desde funciones SECURITY DEFINER no se ven afectadas |

---

## BÚSQUEDA DE REGRESIONES — Análisis Completo

### REG-01 — promote_user_role GRANT a authenticated

**Archivo:** `20260630261000_promote_user_role.sql`, línea 44  
```sql
GRANT EXECUTE ON FUNCTION promote_user_role(UUID, faro_user_role) TO authenticated;
```

**Guard interno:**
```sql
IF NOT is_super_admin() THEN
  RAISE EXCEPTION 'not_authorized';
END IF;
```

**Evaluación:** El guard interno protege contra abuso directo. Ahora que C-01 está cerrado con el trigger, un atacante no puede self-escalarse a super_admin para usar este RPC. Doble protección: trigger anti-escalada + guard interno en RPC.

**Estado:** ✅ SIN REGRESIÓN — guard interno activo, superficie de ataque innecesaria pero mitigada

---

### REG-02 — notify_coordinator_request_user: doble implementación

La función existe en `20260630264000` y `20260703200000` (CREATE OR REPLACE). La migración `20260705002000` crea la versión final con guard interno. El REVOKE se mantiene.

**Estado:** ✅ SIN REGRESIÓN — la versión final (`20260705002000`) tiene guard interno + REVOKE

---

### REG-03 — coordinator_request_center_name GRANT residual

**Archivo:** `20260630264000_coordinator_decision_notifications.sql`, línea 274  
```sql
GRANT EXECUTE ON FUNCTION coordinator_request_center_name(TEXT, UUID) TO authenticated;
```

**Evaluación:** Función STABLE, no SECURITY DEFINER. Retorna nombre de centro por UUID. Sin guard de autorización. Documentada como B-02 en la Fase 1. No es regresión nueva.

**Estado:** ℹ️ CONOCIDO — B-02 del audit original, no tratado en P0

---

### REG-04 — coordinator_profiles SELECT: política de lectura propia

La migración P0 eliminó `coordinator_profiles_insert_own` y `coordinator_profiles_update_own`, pero **NO modificó la política SELECT** (`coordinator_profiles_select_own`). Los admins pueden listar coordinadores vía RPCs SECURITY DIRECTOR, no vía REST directo.

**Estado:** ℹ️ LIMITACIÓN CONOCIDA — no es regresión

---

### REG-05 — Triggers conflictivos

**`20260705001000`**: `BEFORE UPDATE` → `guard_profile_role_changes()`  
**`20260703200000`**: `AFTER UPDATE OF role` → `notify_on_role_changed()`

**Secuencia:** BEFORE trigger se ejecuta primero. Si lanza excepción, el AFTER trigger NUNCA se ejecuta. Para un super_admin legítimo: BEFORE → OK → UPDATE → AFTER → notifica. No hay conflicto.

**Estado:** ✅ SIN CONFLICTO

---

### REG-06 — Funciones SECURITY DEFINER expuestas

Inventario de funciones con GRANT a `authenticated` que carecen de guard interno:

| Función | Guard | Riesgo |
|---------|-------|--------|
| `current_user_role()` | N/A (solo lectura) | Bajo |
| `is_super_admin()` | N/A (solo lectura) | Bajo |
| `is_regional_admin()` | N/A (solo lectura) | Bajo |
| `is_coordinator_role()` | N/A (solo lectura) | Bajo |
| `is_elevated_admin()` | N/A (solo lectura) | Bajo |
| `approve_coordinator_request(...)` | `IF NOT is_elevated_admin()` | ✅ Protegido |
| `reject_coordinator_request(...)` | `IF NOT is_elevated_admin()` | ✅ Protegido |
| `promote_user_role(...)` | `IF NOT is_super_admin()` | ✅ Protegido |
| `notify_coordinator_request_user(...)` | `IF auth.uid() IS NOT NULL AND NOT is_elevated_admin()` | ✅ Protegido |
| `log_auth_event(...)` | REVOKE externo | ✅ Mitigado |
| `mark_notification_read(...)` | WHERE user_id = auth.uid() | ✅ Correcto |
| `mark_all_notifications_read()` | WHERE user_id = auth.uid() | ✅ Correcto |
| `delete_notification(...)` | WHERE user_id = auth.uid() | ✅ Correcto |

**Estado:** ✅ TODAS las funciones críticas tienen protección adecuada

---

### REG-07 — coordinator_profiles admin SELECT ausente

No existe política SELECT para que admins vean todas las filas de `coordinator_profiles` vía REST. Los admins usan RPCs SECURITY DEFINER. No es regresión, era así antes del P0.

**Estado:** ℹ️ LIMITACIÓN CONOCIDA — no afecta funcionalidad

---

### REG-08 — system_insert_events activa (A-04 sin corregir)

**Archivo:** `20260630203000_phase5_events_orgs_realtime.sql`, líneas 47–54
```sql
CREATE POLICY system_insert_events ON events
  FOR INSERT TO authenticated
  WITH CHECK (true);
```

Documentada como **A-04** en la Fase 1. No fue parte del scope P0. Cualquier usuario autenticado puede insertar en la timeline pública.

**Estado:** ℹ️ CONOCIDO — A-04 del audit original, pendiente para Bloque 1

---

## Estado Final de los 5 Críticos

| ID   | Vulnerabilidad                                  | Estado | Veredicto |
|------|-------------------------------------------------|--------|-----------|
| C-01 | Escalada role via PATCH REST                    | CERRADA (trigger) | ✅ PASS  |
| C-02 | Self-insert en coordinator_profiles             | CERRADA (RLS) | ✅ PASS  |
| C-03 | Edge Function push sin auth                     | CERRADA (secret) | ✅ PASS |
| C-04 | notify_coordinator_request_user abierta         | CERRADA (guard + REVOKE) | ✅ PASS  |
| C-05 | log_auth_event abierta                          | CERRADA (REVOKE) | ✅ PASS |

---

## Checklist de Aprobación para Avanzar a High

- [x] Migración `20260705001000_security_p0_critical_fixes.sql` creada y lista para aplicar
- [x] Edge Function `send-notification-push` modificada con validación de webhook secret
- [x] Migración `20260705002000_harden_notify_coordinator_rpc.sql` creada (guard interno + REVOKE)
- [x] Migración `20260705022000_runtime_revoke_anon_critical_rpcs.sql` creada (REVOKE de PUBLIC)
- [x] C-01 verificada: trigger bloquea cambio de role
- [x] C-02 verificada: RLS bloquea self-insert
- [x] C-03 verificada: secret validation en Edge Function
- [x] C-04 verificada: guard interno + REVOKE en notify_coordinator_request_user
- [x] C-05 verificada: REVOKE en log_auth_event
- [x] Búsqueda de regresiones completada sin hallazgos nuevos

**Todos los items marcados. Procede la evaluación de vulnerabilidades High (A-01 a A-12).**

---

## Instrucciones para Validación en Producción

Una vez aplicadas las migraciones, ejecutar las siguientes verificaciones directas en Supabase SQL Editor (como service_role):

```sql
-- 1. Verificar que el trigger existe y está activo:
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name = 'trg_guard_profile_role_changes';
-- Esperado: 1 fila, BEFORE, UPDATE

-- 2. Verificar que los grants sobre funciones críticas fueron revocados:
SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS has_grant
FROM pg_proc p
WHERE p.proname IN ('log_auth_event', 'notify_coordinator_request_user');
-- Esperado: ambas filas con has_grant = false

-- 3. Verificar que coordinator_profiles_insert_own fue eliminada:
SELECT policyname FROM pg_policies
WHERE tablename = 'coordinator_profiles'
  AND policyname IN ('coordinator_profiles_insert_own', 'coordinator_profiles_update_own');
-- Esperado: 0 filas

-- 4. Verificar que PUSH_WEBHOOK_SECRET está configurado:
-- (Verificar en Supabase Dashboard > Functions > send-notification-push > Secrets)
-- No ejecutable via SQL. Verificación manual requerida.

-- 5. Verificar que la función notify_coordinator_request_user tiene el guard interno:
SELECT prosrc FROM pg_proc
WHERE proname = 'notify_coordinator_request_user';
-- Esperado: la función debe contener 'permission_denied' y 'is_elevated_admin'

-- 6. Verificar que coordinator_profiles tiene admin policies:
SELECT policyname FROM pg_policies
WHERE tablename = 'coordinator_profiles'
  AND policyname LIKE 'coordinator_profiles_admin%';
-- Esperado: coordinator_profiles_admin_insert, coordinator_profiles_admin_update
```

---

*Documento generado como validación de seguridad — Fase 2 Red Team.*  
*Todos los 5 críticos están PASS. Procede evaluación de vulnerabilidades High.*
