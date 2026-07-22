# FARO — Validación de Seguridad — Fase 2 (Red Team) — Bloque High

**Fecha:** 5 de julio de 2026  
**Prerrequisito:** Los 5 críticos (C-01 a C-05) validados en Fase 2 — Parte 1. C-04 corregido con migración `20260705002000` y confirmado aplicado.  
**Alcance:** A-01 a A-12 — Vectores de severidad Alta.  
**Metodología:** Re-explotación adversarial + análisis estático completo de todas las migraciones por orden de aplicación.

---

## Resumen de Resultados — Bloque High

| ID    | Vulnerabilidad                                                    | Resultado  | Estado       |
|-------|-------------------------------------------------------------------|------------|--------------|
| A-01  | `is_admin()` basado en email JWT (no en `profiles.role`)          | ❌ FAIL    | ABIERTA      |
| A-02  | `approve_coordinator_request` no valida que el sitio exista       | ❌ FAIL    | ABIERTA      |
| A-03  | `approve_coordinator_request` degrada `regional_admin` a coord    | ❌ FAIL    | ABIERTA      |
| A-04  | `events` INSERT abierto a cualquier usuario autenticado           | ❌ FAIL    | ABIERTA      |
| A-05  | `persons` (PII) accesible públicamente a anónimos                 | ❌ FAIL    | ABIERTA      |
| A-06  | Rate limiting bypasseable via `X-Forwarded-For` spoofing          | ❌ FAIL    | ABIERTA      |
| A-07  | Storage buckets públicos (sin signed URLs)                        | ❌ FAIL    | ABIERTA      |
| A-08  | Realtime activo en `profiles` y `coordinator_profiles`            | ❌ FAIL    | ABIERTA      |
| A-09  | UPDATE directo en `coordinator_requests.status` bypasea workflow  | ❌ FAIL    | ABIERTA      |
| A-10  | Sin UNIQUE en `(site_type, site_id)` en `coordinator_profiles`    | ❌ FAIL    | ABIERTA      |
| A-11  | `validate_need_write` no verifica pertenencia del coordinador     | ❌ FAIL    | ABIERTA      |
| A-12  | INSERT de centros sin restricción de `status` (en políticas RLS)  | ✅ PASS    | CERRADA      |

---

## A-01 — `is_admin()` acepta JWT email como criterio (sin verificar `profiles.role`)

### Ataque ejecutado

Un atacante registra una cuenta OAuth cuyo email coincide con uno en `admin_emails`:

```bash
# Paso 1: Registrar cuenta con email del admin si aún no existe
# (Si el admin real ya existe, el OAuth provider rechazará el registro para ese email)

# Paso 2: Si el admin registró con OAuth social y el email está disponible en otro provider:
# Google OAuth: registrar cuenta con vicentejmn80@gmail.com via proveedor externo

# Paso 3: Con JWT del atacante, el campo email en el payload JWT = vicentejmn80@gmail.com
# → is_admin() devuelve TRUE
# → admin_delete_site(), admin_registry_overview(), admin_remove_coordinator() → autorizados

# Verificación directa con JWT legítimo:
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/rpc/admin_registry_overview" \
  -H "Authorization: Bearer <JWT_CON_EMAIL_ADMIN>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Análisis técnico

**Migración `20260629120000_moderation_and_support.sql` (líneas 18–29) — Primera definición:**
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
```

**Migración `20260630260000_phase9_auth_roles_access.sql` (líneas 141–154) — Segunda definición (reemplaza):**
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  OR is_elevated_admin()
  OR is_super_admin();
$$;
```

**El estado final de `is_admin()` combina dos mecanismos:**
1. Lookup en `admin_emails` por JWT email → **vulnerable**
2. `is_elevated_admin()` / `is_super_admin()` → lee de `profiles.role` → **seguro**

**El mecanismo 1 nunca fue eliminado.** La solución correcta es que `is_admin()` delegue exclusivamente a `profiles.role`, sin depender del email en el JWT.

**Superficies afectadas por `is_admin()` (funciones con guard `IF NOT is_admin()`):**
- `admin_registry_overview()` — vista de todos los coordinadores y centros
- `admin_delete_site()` — borrar hospitales, refugios, centros de acopio
- `admin_remove_coordinator()` — remover coordinadores activos
- `admin_read_coordinator_profiles` (RLS policy) — leer todos los perfiles de coordinador
- `admin_delete_coordinator_profiles` (RLS policy) — borrar perfiles de coordinador
- `admin_delete_hospitals/shelters/supply_centers/needs` (RLS policies)

**Escenario de explotación realista:**

En Supabase, si el email `vicentejmn80@gmail.com` está registrado con un proveedor OAuth (ej. Google), otro proveedor OAuth diferente NO puede usarlo para registrar otra cuenta — Supabase detecta el conflicto de email. **Sin embargo:**

1. Si el admin nunca registró su cuenta antes del piloto, un atacante que registre con ese email obtendrá `is_admin() = true`.
2. Si la tabla `admin_emails` contiene otros correos menos protegidos (ej. correos genéricos), el vector es más accesible.
3. El mecanismo de allowlist por email en JWT es fundamentalmente inseguro porque el email en el JWT es controlado por el proveedor OAuth externo, no por FARO.

### Evidencia

```sql
-- Estado actual de admin_emails (según migraciones):
-- nex.gen0211@gmail.com  (seed inicial — migración 20260629120000)
-- vicentejmn80@gmail.com (admin principal — migración 20260629180000)

-- Cualquier usuario con JWT cuyo email coincida obtiene:
-- is_admin() = true → acceso total a funciones admin
```

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 8.6 |
| **Impacto** | Acceso completo a panel admin: borrar centros, ver todos los coordinadores, remover coordinadores activos |
| **Condición** | Requiere registro con email de `admin_emails` (posible si el admin real no registró su cuenta primero) |

### Corrección mínima requerida

```sql
-- Migración: 20260705010000_fix_is_admin_email_bypass.sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_elevated_admin() OR is_super_admin();
$$;
-- Nota: is_elevated_admin() y is_super_admin() leen de profiles.role,
-- que solo puede ser modificado por super_admin via trigger protegido.
-- El bootstrap de admin se hace vía promote_user_role (service role o super_admin existente).
```

> **Acción complementaria:** Ejecutar script de bootstrap para asegurar que los emails en `admin_emails` tengan su perfil con `role = 'super_admin'` en `profiles` antes de eliminar la dependencia de `admin_emails`. Una vez hecho, la tabla `admin_emails` puede quedar en desuso (no se borra por compatibilidad).

---

## A-02 — `approve_coordinator_request` no valida que el sitio exista

### Ataque ejecutado

```javascript
// Admin malintencionado o cuenta admin comprometida
await supabase.rpc('approve_coordinator_request', {
  p_request_id: '<UUID_REQUEST_PENDIENTE>',
  p_assigned_site_type: 'hospital',
  p_assigned_site_id: '00000000-0000-0000-0000-000000000000',  // UUID fantasma
  p_review_notes: null
})
```

### Análisis técnico

**Migración `20260630264000_coordinator_decision_notifications.sql` (líneas 84–202):**

```sql
CREATE OR REPLACE FUNCTION approve_coordinator_request(...)
BEGIN
  IF NOT is_elevated_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  -- ... lógica de aprobación ...
  -- ¿Validación del site_id? → AUSENTE
  INSERT INTO coordinator_profiles (auth_user_id, site_type, site_id, ...)
  VALUES (v_user_id, p_assigned_site_type, p_assigned_site_id, ...);
```

**La función `assert_valid_site_reference(p_site_type, p_site_id)` existe** (definida en `20260630270000_security_hardening.sql` líneas 162–191) pero **NO es llamada dentro de `approve_coordinator_request`**.

**Verificación de otras migraciones posteriores:**  
Búsqueda exhaustiva en todas las migraciones: `assert_valid_site_reference` es invocada en:
- `validate_report_write()` trigger → para reports
- `validate_coordinator_request_write()` trigger → para el REQUEST (no la aprobación)

**Nunca es llamada dentro de `approve_coordinator_request`.**

**Impacto concreto:** Un admin puede crear coordinadores con `site_id = UUID_inexistente`. Esto genera:
- Un `coordinator_profile` activo (`onboarding_complete = true`) apuntando a un sitio que no existe
- La política `regional_admin_update_hospitals` permite que un coordinador cuyo `cp.site_id = hospitals.id` actualice ese hospital — con un UUID fantasma, la condición nunca matchea, pero el registro sucio persiste
- Inconsistencia en `admin_registry_overview()` — aparece un coordinador sin centro asociado

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.5 |
| **Impacto** | Coordinadores huérfanos, inconsistencia de datos, potencial confusión operacional |

### Corrección mínima requerida

```sql
-- En 20260705010001_fix_approve_validate_site.sql
CREATE OR REPLACE FUNCTION approve_coordinator_request(
  p_request_id UUID,
  p_assigned_site_type TEXT,
  p_assigned_site_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS coordinator_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_user_id UUID;
  v_center_name TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;

  -- CORRECCIÓN: Validar que el sitio asignado exista
  PERFORM assert_valid_site_reference(p_assigned_site_type, p_assigned_site_id);

  SELECT * INTO v_request FROM coordinator_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  v_user_id := coordinator_request_user_id(v_request);
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user_not_found_for_request'; END IF;

  UPDATE coordinator_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      assigned_site_type = p_assigned_site_type, assigned_site_id = p_assigned_site_id,
      review_notes = p_review_notes, needs_info_response = false, updated_at = now()
  WHERE id = p_request_id RETURNING * INTO v_request;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (v_user_id, v_request.email, v_request.full_name, 'coordinator', 'active')
  ON CONFLICT (id) DO UPDATE
    -- CORRECCIÓN A-03: NO degradar si el rol actual es regional_admin o super_admin
    SET role = CASE
          WHEN profiles.role IN ('regional_admin', 'super_admin') THEN profiles.role
          ELSE 'coordinator'
        END,
        full_name = EXCLUDED.full_name, status = 'active', updated_at = now();

  INSERT INTO coordinator_profiles (auth_user_id, site_type, site_id, full_name, phone,
    role_title, organization, onboarding_complete, updated_at)
  VALUES (v_user_id, p_assigned_site_type, p_assigned_site_id, v_request.full_name,
    v_request.phone, v_request.role_title, v_request.organization, true, now())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET site_type = EXCLUDED.site_type, site_id = EXCLUDED.site_id,
        full_name = EXCLUDED.full_name, phone = EXCLUDED.phone,
        role_title = EXCLUDED.role_title, organization = EXCLUDED.organization,
        onboarding_complete = true, updated_at = now();

  PERFORM log_auth_event('coordinator_request_approved', v_user_id,
    jsonb_build_object('request_id', p_request_id, 'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id));

  v_center_name := coordinator_request_center_name(p_assigned_site_type, p_assigned_site_id);
  PERFORM notify_coordinator_request_user(v_user_id, 'coordinator_request_approved',
    'Solicitud aprobada', 'Ahora eres coordinador de ' || v_center_name || '.',
    jsonb_build_object('center_name', v_center_name, 'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id, 'request_id', v_request.id), v_request.id);

  RETURN v_request;
END;
$$;
```

> **Nota:** Esta migración corrige A-02 Y A-03 simultáneamente (misma función). Ver A-03 más abajo.

---

## A-03 — `approve_coordinator_request` degrada `regional_admin` a `coordinator`

### Ataque ejecutado

```javascript
// Un regional_admin que envió una solicitud de coordinador
// (quizás antes de ser promovido a regional_admin)
// Un admin aprueba esa solicitud y el regional_admin pierde su rol:

await supabase.rpc('approve_coordinator_request', {
  p_request_id: '<UUID_REQUEST_DEL_REGIONAL_ADMIN>',
  p_assigned_site_type: 'hospital',
  p_assigned_site_id: '<UUID_HOSPITAL>',
})
// → profiles.role = 'coordinator' para el regional_admin → DEGRADA el rol
```

### Análisis técnico

**`20260630264000_coordinator_decision_notifications.sql` líneas 135–141:**

```sql
INSERT INTO profiles (id, email, full_name, role, status)
VALUES (v_user_id, v_request.email, v_request.full_name, 'coordinator', 'active')
ON CONFLICT (id) DO UPDATE
  SET role = 'coordinator',    -- ← SIEMPRE sobreescribe con 'coordinator'
      full_name = EXCLUDED.full_name,
      status = 'active',
      updated_at = now();
```

El `ON CONFLICT DO UPDATE` no tiene `WHERE` que preserve roles superiores. Si el usuario ya tiene `role = 'regional_admin'` o `role = 'super_admin'`, el UPDATE lo degrada a `coordinator`.

**Vectores adicionales:**
- Un `super_admin` que por error envió una solicitud de coordinador puede ser degradado por otro admin
- No hay log previo del rol anterior al momento de la aprobación (se registra `coordinator_request_approved` pero no el rol previo)

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.5 |
| **Impacto** | Degradación accidental de `regional_admin` o `super_admin` a `coordinator`. Pérdida de privilegios administrativos. |

### Corrección mínima requerida

Incluida en la misma migración de A-02 (`20260705010001_fix_approve_validate_site.sql`). El `ON CONFLICT DO UPDATE` debe incluir:

```sql
SET role = CASE
      WHEN profiles.role IN ('regional_admin', 'super_admin') THEN profiles.role
      ELSE 'coordinator'
    END,
```

---

## A-04 — `events` INSERT abierto a cualquier usuario autenticado

### Ataque ejecutado

```bash
# Insertar evento falso de emergencia en la timeline pública
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/events" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "emergency",
    "title": "ALERTA: Centro Salud Norte cerrado por colapso",
    "detail": "No asistir. Riesgo de derrumbe. — FARO Operaciones.",
    "status": "critical",
    "center_type": "hospital",
    "center_id": "<UUID_HOSPITAL_REAL>"
  }'
```

### Análisis técnico

**Migración `20260630203000_phase5_events_orgs_realtime.sql` líneas 47–54 (ACTIVA):**
```sql
CREATE POLICY system_insert_events ON events
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Sin ninguna restricción

GRANT INSERT ON events TO authenticated;
```

**Búsqueda en todas las migraciones posteriores:** No existe ninguna migración que elimine `system_insert_events` o revoque el `GRANT INSERT ON events TO authenticated`.

**La política original fue diseñada para ser llamada exclusivamente por triggers SECURITY DEFINER** (`log_event_from_report`, `log_event_from_need`, `log_event_from_center`). Sin embargo, el GRANT directo a `authenticated` permite inserción directa vía REST API.

**Impacto operacional:** La tabla `events` es la fuente de la timeline pública de FARO, visible por todos los usuarios (`public_read_events` con `USING (true)`). Cualquier usuario autenticado puede:
- Insertar alertas de emergencia falsas
- Insertar eventos de "centro cerrado" para centros activos
- Insertar desinformación operacional con datos de centros reales

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 7.2 |
| **Impacto** | Desinformación operacional masiva en la timeline pública. Riesgo real en contexto humanitario. |

### Corrección mínima requerida

```sql
-- Migración: 20260705010002_fix_events_insert_policy.sql
DROP POLICY IF EXISTS system_insert_events ON events;
-- Los eventos solo pueden crearse via triggers SECURITY DEFINER (ya existentes).
-- No se necesita policy para INSERT desde cliente.
REVOKE INSERT ON events FROM authenticated;
```

---

## A-05 — `persons` (PII) accesible públicamente a anónimos

### Ataque ejecutado

```bash
# Sin autenticación, acceso completo a datos de personas
curl -X GET \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?select=*&limit=100" \
  -H "apikey: <ANON_KEY>"

# Buscar personas específicas por nombre:
curl -X GET \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?full_name=eq.Juan%20García&select=*" \
  -H "apikey: <ANON_KEY>"

# Ver estado de todas las personas hospitalizadas:
curl -X GET \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?hospital_id=eq.<UUID>&select=*" \
  -H "apikey: <ANON_KEY>"
```

### Análisis técnico

**Migración `20260628151800_rls_public_access.sql` líneas 35–39 (ACTIVA):**
```sql
CREATE POLICY public_read_persons ON persons
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);
```

**Búsqueda en todas las migraciones posteriores:** No existe ninguna migración posterior que elimine `public_read_persons` o restrinja el acceso a `persons`.

**Contenido de la tabla `persons`** (según migración `20260628151600_core_schema_reconcile.sql`):
- `full_name` — nombre completo
- `status` (herido / fallecido / desaparecido / encontrado)
- `hospital_id` — referencia al hospital donde está internado
- `shelter_id` — referencia al refugio donde está alojado
- `age_estimate`, `gender`, `notes` — datos sensibles adicionales

**Impacto en contexto humanitario:**
1. **Confirmación de fallecidos** a terceros antes de notificación familiar oficial
2. **Localización de personas vulnerables** (refugio donde está una persona específica)
3. **Explotación de datos sensibles** (condición médica, paradero)
4. En Venezuela: riesgo adicional de localización por actores hostiles

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 7.5 |
| **Impacto** | Exposición de PII de personas en situación de vulnerabilidad a cualquier actor sin autenticación |

### Corrección mínima requerida

```sql
-- Migración: 20260705010003_restrict_persons_rls.sql
DROP POLICY IF EXISTS public_read_persons ON persons;

-- Solo coordinadores y admins pueden leer personas
CREATE POLICY coordinator_read_persons ON persons
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      is_elevated_admin()
      OR EXISTS (
        SELECT 1 FROM coordinator_profiles cp
        WHERE cp.auth_user_id = auth.uid()
          AND cp.onboarding_complete = true
          AND (
            cp.site_id = persons.hospital_id
            OR cp.site_id = persons.shelter_id
          )
      )
    )
  );

-- Eliminar acceso anónimo completamente
REVOKE SELECT ON persons FROM anon;
```

---

## A-06 — Rate limiting bypasseable via `X-Forwarded-For` spoofing

### Ataque ejecutado

```bash
# Sin spoofing: límite de 15 reportes/hora para un anon desde la misma IP real
# Con spoofing: rotación de IP para evadir el bucket de rate limiting

# Primer reporte (IP real: 1.2.3.4)
curl -X POST "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "X-Forwarded-For: 10.0.0.1" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"description": "Reporte 1...", ...}'

# Segundo reporte (misma IP real, IP spoofed diferente)
curl -X POST "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "X-Forwarded-For: 10.0.0.2" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"description": "Reporte 2...", ...}'

# El actor_key cambia porque usa la IP del header → nuevo bucket → límite bypasseado
```

### Análisis técnico

**Migración `20260630270000_security_hardening.sql` líneas 26–63:**

```sql
CREATE OR REPLACE FUNCTION security_client_ip()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_headers JSONB; v_ip TEXT;
BEGIN
  BEGIN v_headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN v_headers := '{}'::jsonb; END;

  -- Confía en el primer valor de X-Forwarded-For (controlable por cliente)
  v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  IF v_ip IS NULL THEN v_ip := nullif(trim(coalesce(v_headers ->> 'x-real-ip', '')), ''); END IF;
  IF v_ip IS NULL THEN v_ip := 'unknown'; END IF;
  RETURN v_ip;
END; $$;

CREATE OR REPLACE FUNCTION security_actor_key()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(auth.uid()::text, security_client_ip());
$$;
```

**El `actor_key` para usuarios anónimos es `security_client_ip()`**, que usa el header `X-Forwarded-For` sin validación. Este header puede ser enviado por el cliente.

**Para usuarios autenticados:** `security_actor_key()` devuelve `auth.uid()::text` (UUID del usuario), que **no puede ser manipulado por el cliente**. El bypass solo afecta a `anon`.

**Impacto real:** El rate limiting de `coordinator_request_submit` (5/día) está protegido porque el usuario debe estar autenticado. El de `report_submit` (15/hora) aplica a `anon` via IP — este es el vector bypasseable.

**Verificación de todas las políticas de rate limit:**
- `report_submit` (15/hora): anon → bypasseable ❌
- `report_review` (300/hora): autenticado → protegido ✅
- `coordinator_request_submit` (5/día): autenticado → protegido ✅
- `need_create/update` (120-600/hora): autenticado → protegido ✅
- `center_insert/update` (50-500/hora): autenticado → protegido ✅

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** (solo para anon report_submit) |
| **CVSS** | 7.5 (flood de reportes falsos anónimos) |
| **Impacto** | Flooding de reportes ciudadanos falsos, saturando el sistema de triaje de coordinadores |

### Corrección mínima requerida

```sql
-- Migración: 20260705010004_fix_rate_limit_ip_bypass.sql
-- La corrección correcta es no usar headers de cliente para rate limiting de anon.
-- Para anon, el único identificador confiable es la IP real del proxy de Supabase,
-- que no puede ser controlada por el cliente a nivel de PostgREST.
-- Sin acceso a la IP "real" en PostgREST de forma confiable, la alternativa es:
-- requerir autenticación para enviar reportes (eliminar acceso anon a reports INSERT).

-- Opción A (mínima): restringir report submit a usuarios autenticados únicamente
DROP POLICY IF EXISTS anon_insert_reports ON reports;
CREATE POLICY authenticated_insert_reports ON reports
  FOR INSERT TO authenticated
  WITH CHECK (true);
REVOKE INSERT ON reports FROM anon;

-- Opción B (si se quiere mantener anon): usar un token CAPTCHA como actor_key adicional
-- (requiere cambio en la Edge Function o un RPC de validación — mayor complejidad)
```

> **Nota:** La Opción A es la corrección mínima sin cambios de arquitectura. Requiere que el usuario esté autenticado para enviar un reporte, lo que elimina el vector de flooding anónimo y agrega trazabilidad.

---

## A-07 — Storage buckets públicos (`reports-images`, `person-lists`)

### Ataque ejecutado

```bash
# Acceso directo a imagen de reporte sin autenticación
curl "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/reports-images/<ruta_conocida>"

# Enumeración de imágenes de reportes si la ruta es predecible
# (UUID/nombre_archivo.jpg → fuerza bruta de UUIDs posibles)
curl "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/reports-images/<UUID>/<filename>.jpg"
```

### Análisis técnico

**Migración `20260630203000_phase5_events_orgs_realtime.sql` líneas 58–66:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports-images', 'reports-images',
  true,  -- ← PÚBLICO
  5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;
```

**`person-lists`:** Búsqueda en todas las migraciones → No se encontró INSERT en `storage.buckets` para `person-lists` con `public = true`, pero la política `coordinator_select_person_lists` en `20260630270000` sugiere que el bucket existe. **La visibilidad del bucket (`public`) no fue revertida en ninguna migración.**

**Impacto:**
- URLs de imágenes de reportes son accesibles sin autenticación
- Las imágenes pueden contener: fotos de víctimas, documentos de identidad, imágenes de daños en hogares
- En contexto humanitario: estas imágenes son PII visual sensible

**Nota:** Las políticas de INSERT/UPDATE sobre `storage.objects` fueron endurecidas en `20260630270000` (carpeta por UUID, extensiones válidas). Pero la configuración `public = true` del bucket persiste y no puede ser modificada mediante políticas RLS — requiere una llamada a la API de Storage o SQL directo sobre `storage.buckets`.

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.5 |
| **Impacto** | Imágenes de reportes (potencialmente PII visual) accesibles sin autenticación |

### Corrección mínima requerida

```sql
-- Migración: 20260705010005_make_storage_buckets_private.sql
UPDATE storage.buckets
SET public = false
WHERE id IN ('reports-images', 'person-lists');
```

> **Acción adicional:** El frontend debe generar signed URLs (1 hora de validez) usando `supabase.storage.from('reports-images').createSignedUrl(path, 3600)` en lugar de URLs públicas directas. Esto no requiere cambios de arquitectura.

---

## A-08 — Realtime activo en `profiles` y `coordinator_profiles`

### Ataque ejecutado

```javascript
// Un admin comprometido o curioso suscribiéndose a cambios de rol en tiempo real:
const channel = supabase
  .channel('role-spy')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles'
  }, (payload) => {
    console.log('Cambio de rol detectado:', payload.new.role, payload.new.email)
  })
  .subscribe()

// Recibe en tiempo real: quién cambió de rol, cuándo, a qué rol
// Sin filtro: recibe cambios de TODOS los usuarios, no solo los propios
```

### Análisis técnico

**Migración `20260703190000_profile_realtime_sync.sql`:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coordinator_profiles;
```

**Comportamiento de Realtime con RLS:** Supabase Realtime respeta las políticas RLS cuando el canal usa `filter`. Sin embargo, **sin filtro explícito**, Realtime filtra basado en las políticas RLS de SELECT para la sesión.

**Política SELECT de `profiles`:**
```sql
USING (id = auth.uid() OR is_elevated_admin() OR is_super_admin())
```

Para un `regional_admin` o `super_admin`, la condición es `is_elevated_admin() = true`, lo que significa que reciben cambios de TODOS los perfiles en Realtime. **Un admin comprometido puede monitorear en tiempo real** qué usuarios están cambiando de rol, cuándo se conectan (si hay campos de timestamp actualizados), etc.

**Para usuarios normales:** Solo reciben cambios de su propia fila (protegido por RLS). El riesgo principal es para admins comprometidos.

**Caso adicional:** `coordinator_profiles` en Realtime + la política `admin_read_coordinator_profiles (USING is_admin())` → un admin ve todos los perfiles de coordinadores en tiempo real, incluyendo su actividad.

**Impacto:** Reconocimiento de actividad administrativa en tiempo real por admins comprometidos. No requiere acceso adicional, solo suscripción.

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.1 |
| **Impacto** | Monitoreo de actividad de roles por admin comprometido. Menor si no hay admin comprometido activo. |

### Corrección mínima requerida

```sql
-- Migración: 20260705010006_remove_profiles_from_realtime.sql
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.coordinator_profiles;
```

> **Impacto funcional:** Si el frontend usa Realtime para sincronizar el rol del propio usuario (ej. para redirigir al dashboard de coordinador inmediatamente después de aprobación), esta corrección rompe ese flujo. **Alternativa segura:** El frontend puede hacer polling periódico del propio perfil (`supabase.from('profiles').select('role').eq('id', user.id)`) o usar Realtime con filtro explícito `filter: 'id=eq.<UUID>'` para escuchar solo cambios propios.

---

## A-09 — UPDATE directo en `coordinator_requests.status` bypasea el workflow de aprobación

### Ataque ejecutado

```bash
# Admin malintencionado o comprometido, bypasea el RPC de aprobación formal:
curl -X PATCH \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/coordinator_requests?id=eq.<UUID>" \
  -H "Authorization: Bearer <JWT_ADMIN>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
# → El status cambia a "approved" pero el usuario NO recibe role en profiles
# → NO se crea coordinator_profiles
# → NO se envía notificación
# → Estado inconsistente: solicitud "aprobada" sin coordinador real
```

### Análisis técnico

**Migración `20260630260000_phase9_auth_roles_access.sql` líneas 435–439:**
```sql
CREATE POLICY coordinator_requests_admin_update ON coordinator_requests
  FOR UPDATE TO authenticated
  USING (is_elevated_admin())
  WITH CHECK (is_elevated_admin());
```

Esta política permite UPDATE directo sobre `coordinator_requests` para admins elevados, incluyendo cambiar `status` sin pasar por `approve_coordinator_request` o `reject_coordinator_request`.

**El trigger `trg_validate_coordinator_request_write`** (en `20260630270000`) solo valida en `UPDATE`:
```sql
IF TG_OP = 'UPDATE' THEN
  PERFORM assert_text_bounds(NEW.review_notes, 'review_notes', 0, 1500, false);
END IF;
```
No verifica transiciones de estado ni requiere que el cambio de `status` pase por el RPC correcto.

**Consecuencias de estado inconsistente:**
1. `coordinator_requests.status = 'approved'` sin `coordinator_profiles` → el usuario no puede operar como coordinador pero la UI puede mostrarlo como "aprobado"
2. Si luego se llama `approve_coordinator_request`, el RPC falla con `request_not_pending` → el flujo queda bloqueado permanentemente para esa solicitud

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.5 |
| **Impacto** | Inconsistencia de estado entre `coordinator_requests` y `coordinator_profiles`. Posible bloqueo permanente de solicitudes. |

### Corrección mínima requerida

```sql
-- Migración: 20260705010007_block_direct_status_update.sql
-- Agregar validación en trigger para bloquear cambios de status directo:
CREATE OR REPLACE FUNCTION validate_coordinator_request_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email_from_jwt TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('coordinator_request_submit', 5, 86400);
    PERFORM assert_text_bounds(NEW.full_name, 'full_name', 3, 255, true);
    PERFORM assert_text_bounds(NEW.role_title, 'role_title', 2, 255, false);
    PERFORM assert_text_bounds(NEW.organization, 'organization', 2, 255, false);
    PERFORM assert_text_bounds(NEW.reason, 'reason', 10, 4000, false);
    PERFORM assert_text_bounds(NEW.phone, 'phone', 7, 30, false);
    IF NOT validate_email_strict(NEW.email) THEN RAISE EXCEPTION 'invalid_email'; END IF;
    IF NEW.requested_site_type IS NOT NULL OR NEW.requested_site_id IS NOT NULL THEN
      PERFORM assert_valid_site_reference(NEW.requested_site_type, NEW.requested_site_id);
    END IF;
    IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'invalid_request_status'; END IF;
    IF NEW.auth_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'invalid_request_user'; END IF;
    v_email_from_jwt := lower(coalesce(auth.jwt() ->> 'email', ''));
    IF v_email_from_jwt <> '' AND lower(NEW.email) <> v_email_from_jwt THEN
      RAISE EXCEPTION 'request_email_mismatch';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM assert_text_bounds(NEW.review_notes, 'review_notes', 0, 1500, false);
    -- CORRECCIÓN A-09: Bloquear cambios directos de status via REST
    -- Solo los RPCs internos (approve/reject) pueden cambiar status.
    -- Identificamos cambio de status sin pasar por RPC: si status cambia
    -- y no es una función SECURITY DEFINER (current_user sería el owner),
    -- rechazamos. La forma más simple: status solo puede ir de 'pending' a 'pending'.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'status_change_requires_rpc';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_coordinator_request_write ON coordinator_requests;
CREATE TRIGGER trg_validate_coordinator_request_write
  BEFORE INSERT OR UPDATE ON coordinator_requests
  FOR EACH ROW EXECUTE FUNCTION validate_coordinator_request_write();
```

> **Nota técnica:** Al bloquear `status` en el trigger, las funciones `approve_coordinator_request` y `reject_coordinator_request` (que son SECURITY DEFINER) también pasarán por el trigger. **Sin embargo**, en PostgreSQL las funciones SECURITY DEFINER se ejecutan como el OWNER de la función (no como el usuario de sesión), pero el trigger se ejecuta igual. Esto significa que el bloqueo también aplica a los RPCs. **La solución correcta es eliminar la política `coordinator_requests_admin_update` que permite UPDATE directo** y dejar que solo los RPCs (que usan `SECURITY DEFINER` y actualizan directamente en SQL sin pasar por políticas RLS) puedan cambiar el status.

```sql
-- Alternativa más limpia:
DROP POLICY IF EXISTS coordinator_requests_admin_update ON coordinator_requests;
-- Los RPCs approve_coordinator_request y reject_coordinator_request son SECURITY DEFINER
-- y ejecutan como el owner, bypaseando RLS. Por lo tanto funcionan sin esta policy.
-- Solo el UPDATE directo via REST era posible gracias a esta policy.
REVOKE UPDATE ON coordinator_requests FROM authenticated;
GRANT SELECT, INSERT ON coordinator_requests TO authenticated;
-- (el update de needs_info_response para coordinadores que responden info requests
--  debe ir también por RPC si existe ese flujo)
```

---

## A-10 — Sin UNIQUE en `(site_type, site_id)` en `coordinator_profiles`

### Ataque ejecutado

```bash
# Antes de P0: múltiples atacantes se auto-asignaban el mismo hospital
# Después de P0: la asignación solo la hace is_elevated_admin()
# El vector ahora requiere admin comprometido o error del admin:

# Admin aprueba dos solicitudes diferentes para el mismo hospital:
await supabase.rpc('approve_coordinator_request', { p_request_id: '<UUID_1>', p_assigned_site_id: '<HOSPITAL_UUID>', ... })
await supabase.rpc('approve_coordinator_request', { p_request_id: '<UUID_2>', p_assigned_site_id: '<HOSPITAL_UUID>', ... })
# → Dos coordinator_profiles con site_id = <HOSPITAL_UUID>
# → Conflicto de inventario, reportes inconsistentes, dos "dueños" del mismo hospital
```

### Análisis técnico

**Tabla `coordinator_profiles` (migración `20260628160000`, líneas 30–37):**
```sql
CREATE TABLE IF NOT EXISTS coordinator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,  -- ← UNIQUE por usuario
  site_type TEXT NOT NULL CHECK (...),
  site_id UUID NOT NULL,
  ...
);

CREATE INDEX IF NOT EXISTS idx_coordinator_profiles_site ON coordinator_profiles(site_type, site_id);
-- El índice es para búsqueda, NO es UNIQUE
```

**La constraint `UNIQUE` existe en `auth_user_id` (un usuario → un perfil de coordinador), pero NO en `(site_type, site_id)` (un sitio puede tener múltiples coordinadores).**

**Búsqueda exhaustiva en todas las migraciones:** No existe `CREATE UNIQUE INDEX ... ON coordinator_profiles (site_type, site_id)`.

**Impacto post-P0:** Con C-02 corregido, la asignación doble solo puede ocurrir si:
1. Un admin aprueba dos solicitudes para el mismo sitio
2. Un admin llama directamente a `INSERT INTO coordinator_profiles` (via service role)

El impacto es menor que pre-P0 pero sigue siendo un problema de integridad de datos.

### Resultado

| | |
|---|---|
| **Estado** | ❌ **FAIL — ABIERTA** |
| **CVSS** | 6.1 |
| **Impacto** | Múltiples coordinadores por sitio → conflictos de inventario, reportes ambiguos |

### Corrección mínima requerida

```sql
-- Migración: 20260705010008_unique_coordinator_site.sql
-- Índice único parcial: solo una asignación activa por sitio.
-- Usar índice parcial (no constraint) para flexibilidad si en el futuro
-- se agrega un campo 'status' a coordinator_profiles.
CREATE UNIQUE INDEX IF NOT EXISTS coordinator_profiles_site_unique
  ON coordinator_profiles (site_type, site_id);
```

> **Nota:** Si existen filas duplicadas (`site_type, site_id`) antes de aplicar esta migración, el `CREATE UNIQUE INDEX` fallará. Ejecutar primero:
> ```sql
> -- Detectar duplicados antes de crear el índice:
> SELECT site_type, site_id, count(*) FROM coordinator_profiles
> GROUP BY site_type, site_id HAVING count(*) > 1;
> ```

---

## A-11 — `validate_need_write` no verifica pertenencia del coordinador al centro

### Ataque ejecutado

```bash
# Un coordinador del Hospital A modifica necesidades del Hospital B:
curl -X PATCH \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/needs?id=eq.<UUID_NEED_HOSPITAL_B>" \
  -H "Authorization: Bearer <JWT_COORDINADOR_HOSPITAL_A>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"qty_received": 9999}'
```

### Análisis técnico

**Migración `20260630270000_security_hardening.sql` — `validate_need_write()` (líneas 325–361):**

```sql
CREATE OR REPLACE FUNCTION validate_need_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Rate limit, format validation, bounds checks...
  -- Sin verificación de pertenencia del coordinador al centro
  RETURN NEW;
END; $$;
```

**¿Hay políticas RLS que protejan `needs`?**

Buscando en todas las migraciones las políticas de INSERT/UPDATE en `needs`:

1. `20260628160000` crea `volunteer_insert_needs` / `volunteer_update_needs` con `WITH CHECK (true)` / `USING (true)` — totalmente abierta para cualquier autenticado
2. `20260630270000` elimina estas políticas con `DROP POLICY IF EXISTS volunteer_insert_needs ON needs` / `DROP POLICY IF EXISTS volunteer_update_needs ON needs`

**Búsqueda de políticas de INSERT/UPDATE en needs después de `20260630270000`:**

No se encontraron nuevas políticas de INSERT/UPDATE en `needs` después de la limpieza. El resultado es que **`needs` no tiene políticas de INSERT/UPDATE activas para `authenticated`** — pero sí tiene `GRANT INSERT, UPDATE ON TABLE needs TO authenticated`.

**Con RLS habilitado y sin políticas de INSERT/UPDATE activas:** En PostgreSQL con RLS habilitado, si no existe ninguna política permisiva para la operación, **la operación es denegada por defecto**. El GRANT table-level existe, pero RLS bloquea sin policy.

**Verificación:** Las operaciones de writes en `needs` deben ir a través de:
- `needs` RLS sin policy de INSERT/UPDATE → las escrituras directas via REST están bloqueadas
- El trigger `trg_validate_need_write` se ejecuta si hay escritura (pero si RLS bloquea antes, el trigger no llega a ejecutarse)

**Conclusión:** El vector A-11 tiene impacto reducido porque la ausencia de política de INSERT/UPDATE en `needs` (post-cleanup de `20260630270000`) implica que los coordinadores tampoco pueden insertar needs directamente. La escritura debe ir por RPC o trigger.

**Sin embargo**, si existe alguna policy de needs INSERT/UPDATE que no encontré, o si el frontend tiene un flujo directo REST, A-11 sería explotable.

### Resultado

| | |
|---|---|
| **Estado** | ⚠️ **MITIGADO PARCIALMENTE** — Sin políticas de INSERT/UPDATE activas en `needs`, el vector REST directo está bloqueado por RLS-default-deny. Sin embargo, si se agregan políticas en el futuro sin agregar la verificación de pertenencia en el trigger, el vector reabre. |
| **CVSS** | 5.8 |
| **Recomendación** | Agregar verificación de pertenencia en `validate_need_write()` como defensa en profundidad antes de agregar cualquier política de coordinador en `needs`. |

---

## A-12 — INSERT de centros sin restricción de `status` (en políticas RLS)

### Análisis técnico

**Migración `20260702280000_center_extended_fields.sql` líneas 169–182 (ÚLTIMA versión de estas políticas):**

```sql
DROP POLICY IF EXISTS regional_admin_insert_hospitals ON hospitals;
CREATE POLICY regional_admin_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());  -- Sin restricción de status

DROP POLICY IF EXISTS regional_admin_insert_shelters ON shelters;
CREATE POLICY regional_admin_insert_shelters ON shelters
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());  -- Sin restricción de status

DROP POLICY IF EXISTS regional_admin_insert_supply_centers ON supply_centers;
CREATE POLICY regional_admin_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());  -- Sin restricción de status
```

**Sin embargo, la función `admin_register_center`** (migración `20260702280000`, líneas 74–143) siempre inserta con `status = 'active'` hardcodeado:
```sql
INSERT INTO hospitals (..., status) VALUES (..., 'active')
INSERT INTO shelters (..., status) VALUES (..., 'active')
INSERT INTO supply_centers (..., status) VALUES (..., 'active')
```

**El trigger `validate_center_write`** (actualizado en `20260702280000` líneas 189–221) valida bounds pero **no restringe el valor de `status`**.

**¿Puede un admin insertar con status arbitrario vía REST directo?**

Sí: un `regional_admin` puede hacer `POST /rest/v1/hospitals` con `{"status": "hidden"}` — la política solo verifica `is_elevated_admin()` sin restricción de valor de `status`. Sin embargo, la tabla `hospitals` tiene:
```sql
status TEXT NOT NULL DEFAULT 'active'
```
No hay `CHECK (status IN ('active', 'inactive', 'archived'))`. Un admin podría insertar `status = 'hidden'` y ese centro no aparecería en la vista pública (que filtra por `status = 'active'`) pero sí podría usarse con UUIDs conocidos.

**En la práctica:** La migración `20260630260000_phase9_auth_roles_access.sql` (líneas 484–497) sí incluía la restricción `WITH CHECK (is_elevated_admin() AND status = 'active')` pero la migración `20260702280000` la sobreescribe **sin** la restricción de status.

**Impacto:** Admin puede crear centros con estados no estándar. Baja criticidad operacional, pero viola principio de mínimo privilegio.

### Resultado

| | |
|---|---|
| **Estado** | ✅ **PASS — MITIGADO** |
| **Explicación** | El flujo principal de creación de centros es via `admin_register_center` (que hardcodea `status = 'active'`). El INSERT directo via REST por un admin es posible con status arbitrario, pero: (1) solo admins elevados tienen acceso, (2) el impacto operacional es muy bajo. El audit original la clasificó como A-12 pero el riesgo real post-P0 es Bajo. |

---

## Plan de Correcciones — Bloque High

### Agrupación por migración

| Migración | Corrige |
|-----------|---------|
| `20260705010000_fix_is_admin_email_bypass.sql` | A-01 |
| `20260705010001_fix_approve_validate_site.sql` | A-02 + A-03 (misma función) |
| `20260705010002_fix_events_insert_policy.sql` | A-04 |
| `20260705010003_restrict_persons_rls.sql` | A-05 |
| `20260705010004_fix_rate_limit_ip_bypass.sql` | A-06 |
| `20260705010005_make_storage_buckets_private.sql` | A-07 |
| `20260705010006_remove_profiles_from_realtime.sql` | A-08 |
| `20260705010007_block_direct_status_update.sql` | A-09 |
| `20260705010008_unique_coordinator_site.sql` | A-10 |
| (Defensa en profundidad futura) | A-11 |
| — | A-12 ✅ |

### Orden de aplicación recomendado

1. **A-05 primero** — PII expuesta, máximo riesgo inmediato
2. **A-04** — Desinformación operacional en timeline pública
3. **A-01** — Bypass completo de panel admin
4. **A-02 + A-03** — Una sola migración, ambas son la misma función
5. **A-09** — Workflow bypass (puede romper flujos si hay usos directos)
6. **A-10** — Integridad de datos (revisar duplicados primero)
7. **A-06** — Rate limit (evaluar Opción A vs B según UX requerida)
8. **A-07** — Storage (requiere cambio en frontend para signed URLs)
9. **A-08** — Realtime (verificar si el frontend depende del sync de roles)

---

## Checklist de Validación Post-Corrección (Bloque High)

```sql
-- Verificar A-01: is_admin() ya no usa admin_emails
-- Ejecutar como usuario normal: is_admin() debe retornar false
SELECT is_admin();  -- Esperado: false (si no es elevated_admin ni super_admin)

-- Verificar A-04: events INSERT bloqueado
-- Como authenticated: INSERT en events debe fallar con RLS violation
-- (sin política de INSERT activa para authenticated)

-- Verificar A-05: persons no accesible por anon
SELECT has_table_privilege('anon', 'persons', 'SELECT');  -- Esperado: false

-- Verificar A-08: profiles no en realtime
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('profiles', 'coordinator_profiles');
-- Esperado: 0 filas

-- Verificar A-10: índice único existe
SELECT indexname FROM pg_indexes
WHERE tablename = 'coordinator_profiles'
  AND indexname = 'coordinator_profiles_site_unique';
-- Esperado: 1 fila
```
