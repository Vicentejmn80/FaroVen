# FARO — Remediación HIGH Severity

**Fecha:** 5 de julio de 2026  
**Alcance:** Vulnerabilidades HIGH únicamente, una por una.  
**Estado:** En progreso.

---

## A-05 — PII en `persons` expuesta públicamente

### ¿Cómo la explotaría un atacante real?
Un atacante sin autenticación puede consultar `public.persons` vía PostgREST y enumerar personas registradas en hospitales/refugios usando:

```bash
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?select=*" \
  -H "apikey: <ANON_KEY>"
```

---

## A-04 — Inserción abierta en la tabla `events`

### ¿Cómo la explotaría un atacante real?
Cualquier usuario autenticado puede insertar eventos falsos en la timeline pública mediante PostgREST:

```bash
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/events" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"emergency","title":"ALERTA FARO","detail":"Centro X cerrado","status":"critical"}'
```

### ¿Qué datos podría obtener?
No requiere leer datos; permite **inyectar** desinformación visible a toda la población.

### ¿Qué impacto tendría durante una emergencia nacional?
Desinformación operacional: cierres falsos, rutas bloqueadas inexistentes, saturación simulada. Puede desviar recursos, provocar pánico y dañar la respuesta humanitaria.

### ¿Cuál es el parche mínimo?
Eliminar la política `system_insert_events` y revocar `INSERT` para `authenticated`/`anon`.  
Los eventos seguirán generándose vía triggers `SECURITY DEFINER` existentes.

### ¿Cómo demostramos que quedó cerrada?
1. **Usuario autenticado normal**: `POST /events` debe devolver 401/403 por RLS.  
2. **Triggers internos** (reportes/needs/centros) deben seguir generando eventos.

### Causa raíz
La política `system_insert_events` permite INSERT a cualquier usuario autenticado con `WITH CHECK (true)` y existe un GRANT explícito de INSERT a `authenticated`.

### Evidencia (migración origen)
Archivo: `supabase/migrations/20260630203000_phase5_events_orgs_realtime.sql`
```sql
CREATE POLICY system_insert_events
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT INSERT ON events TO authenticated;
```

### Solución implementada (mínimo impacto)
Nueva migración que:
- elimina `system_insert_events`
- revoca `INSERT` en `events` para `authenticated` y `anon`

### Archivos modificados
- `supabase/migrations/20260705012000_lockdown_events_insert.sql`

### Migraciones
- `20260705012000_lockdown_events_insert.sql`

### Riesgos de regresión
- Usuarios autenticados ya no podrán insertar eventos manualmente (esperado).
- Si existiera algún cliente que inserta eventos directamente por REST, dejará de funcionar.
- Los triggers `log_event_from_report`, `log_event_from_need`, `log_event_from_center` deben seguir operando (owner con bypass RLS).

### Pruebas necesarias (validación)
```bash
# 1. Usuario normal: debe fallar
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/events" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"emergency","title":"ALERTA FARO","detail":"Centro X cerrado","status":"critical"}'

# 2. Validar que los triggers siguen generando eventos (SQL)
-- Crear un reporte o need en entorno controlado y verificar:
SELECT * FROM events ORDER BY created_at DESC LIMIT 5;
```

### Validación de regresión (proyecto)
Se revisó todo el código buscando inserciones directas en `events`:
- No existe ningún `supabase.from('events').insert(...)` en frontend ni servicios.
- No existen RPCs que inserten directamente en `events` desde el cliente.
- Los eventos se generan únicamente por triggers (`log_event_from_report`, `log_event_from_need`, `log_event_from_center`).

**Conclusión:** el parche no rompe flujos existentes, porque ninguna ruta depende de INSERT manual en `events`.

### ¿Qué datos podría obtener?
- Nombres completos, estado, hospital/refugio asociado, notas internas, timestamps.  
- Información sensible de personas vulnerables en crisis.

### ¿Qué impacto tendría durante una emergencia nacional?
Exposición de víctimas o desaparecidos. Permite explotación dirigida, extorsión o acoso a familias, y afecta la confianza pública en FARO.

### ¿Cuál es el parche mínimo?
Eliminar la política `public_read_persons` y permitir lectura solo a coordinadores del sitio o admins, manteniendo RLS y sin cambios de arquitectura.

### ¿Cómo demostramos que quedó cerrada?
1. **Anon**: `GET /persons` debe devolver 401/403.  
2. **Usuario autenticado sin rol**: `GET /persons` debe devolver 403.  
3. **Coordinador** del hospital/refugio: puede leer solo filas de su sitio.  
4. **Admin**: puede leer todas las filas (si aplica).

### Causa raíz
La política `public_read_persons` permite SELECT anónimo (`TO anon, authenticated`) con `USING (deleted_at IS NULL)` sin validar roles.

### Vector de ataque
Uso directo de PostgREST con la anon key para enumerar registros completos de `persons`.

### Impacto operativo real
Exposición masiva de PII durante emergencias; riesgo de daño a personas, manipulación, y pérdida de confianza pública.

### Solución implementada (mínimo impacto)
Nueva migración que elimina `public_read_persons` y crea `coordinator_read_persons` con:
- `deleted_at IS NULL`
- Acceso solo a coordinadores del sitio (`hospital`/`shelter`) o `is_elevated_admin()`

### Archivos modificados
- `supabase/migrations/20260705011000_harden_persons_public_read.sql`

### Migraciones
- `20260705011000_harden_persons_public_read.sql`

### Riesgos de regresión
- Usuarios anónimos ya no podrán leer el registry de personas desde la UI pública.  
- Coordinadores solo verán personas de su sitio; si hay vistas globales en frontend, deberán estar basadas en permisos admin.

### Pruebas necesarias (validación)
```bash
# 1. Anónimo: debe fallar
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?select=*" \
  -H "apikey: <ANON_KEY>"

# 2. Usuario normal autenticado: debe fallar
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?select=*" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_USUARIO_NORMAL>"

# 3. Coordinador de hospital X: debe devolver solo sus filas
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/persons?select=*&hospital_id=eq.<HOSPITAL_UUID>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_COORDINADOR>"
```

---

## A-07 — Storage buckets públicos (`reports-images`, `person-lists`)

### ¿Cómo la explotaría un atacante real?
Con buckets públicos, un atacante puede descargar imágenes sensibles si conoce o adivina el path:

```bash
curl -I "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/reports-images/<path>"
curl -I "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/person-lists/<path>"
```

### ¿Qué datos podría obtener?
- Fotos de reportes ciudadanos (personas heridas, ubicaciones, documentos).
- Imágenes de listas de personas en hospitales/refugios.

### ¿Qué impacto tendría durante una emergencia nacional?
Exposición de víctimas y listas internas. Riesgo de acoso, explotación y pérdida de confianza pública.

### ¿Cuál es el parche mínimo?
Hacer los buckets privados (`public = false`) y eliminar lectura pública.  
Conservar políticas de lectura por owner/coordinador existentes.

### ¿Cómo demostramos que quedó cerrada?
1. **Anon**: acceso a `.../object/public/reports-images/...` debe devolver 403.  
2. **Anon**: acceso a `.../object/public/person-lists/...` debe devolver 403.  
3. **Owner**: puede leer su propio objeto con URL firmada o vía policy owner.  

### Causa raíz
- `reports-images` y `person-lists` fueron creados con `public = true`.
- Existía `public_read_reports_images` que permitía SELECT abierto.

### Evidencia (migraciones origen)
Archivo: `supabase/migrations/20260630203000_phase5_events_orgs_realtime.sql`
```sql
INSERT INTO storage.buckets (id, name, public, ...)
VALUES ('reports-images', 'reports-images', true, ...);

CREATE POLICY public_read_reports_images
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'reports-images');
```

Archivo: `supabase/migrations/20260629160000_coordinator_person_registry.sql`
```sql
INSERT INTO storage.buckets (id, name, public, ...)
VALUES ('person-lists', 'person-lists', true, ...);
```

### Solución implementada (mínimo impacto)
Nueva migración que:
- cambia ambos buckets a `public = false`
- elimina `public_read_reports_images`
- agrega `authenticated_select_reports_images` para lectura por owner

### Archivos modificados
- `supabase/migrations/20260705013000_harden_storage_public_buckets.sql`

### Migraciones
- `20260705013000_harden_storage_public_buckets.sql`

### Riesgos de regresión
- Enlaces públicos ya compartidos de imágenes dejarán de funcionar.
- Vistas públicas que mostraban imágenes sin autenticación se romperán.
- Se requerirán URLs firmadas o sesión autenticada para ver imágenes.

### Pruebas necesarias (validación)
```bash
# 1. Anónimo: debe fallar (403)
curl -I "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/reports-images/<path>"

# 2. Anónimo: person-lists debe fallar (403)
curl -I "https://gfngmbbotqzzchjzgajo.supabase.co/storage/v1/object/public/person-lists/<path>"

# 3. Usuario autenticado dueño: debe permitir lectura usando URL firmada
# (Generar signed URL vía SDK y hacer GET)
```

---

## A-09 — UPDATE directo sobre `coordinator_requests.status`

### ¿Cómo la explotaría un atacante real?
Un admin comprometido (o cuenta elevada robada) podría aprobar o rechazar solicitudes con un `UPDATE` directo, saltándose la lógica de los RPCs:

```bash
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/coordinator_requests?id=eq.<REQUEST_ID>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_ADMIN>" \
  -H "Content-Type: application/json" \
  -X PATCH \
  -d '{"status":"approved","reviewed_by":"<UUID_ADMIN>","reviewed_at":"2026-07-05T00:00:00Z"}'
```

### ¿Qué impacto tendría durante una emergencia nacional?
Se rompe el workflow de aprobación: no se crean perfiles de coordinador, no se asignan centros, no se generan notificaciones ni auditoría. Esto puede bloquear coordinadores legítimos y dejar centros sin administración operativa.

### ¿Cuál es el parche mínimo?
Eliminar el UPDATE directo por RLS y forzar que todas las transiciones de estado ocurran vía RPCs (`approve_coordinator_request`, `reject_coordinator_request`, `request_coordinator_info`, `respond_coordinator_info`).

### ¿Cómo demostramos que quedó cerrada?
1. `PATCH /coordinator_requests` con JWT admin debe devolver 403.  
2. RPC `approve_coordinator_request` y `reject_coordinator_request` deben seguir funcionando.  

### Causa raíz
La política RLS `coordinator_requests_admin_update` permite `UPDATE` con `is_elevated_admin()` y existe `GRANT UPDATE` a `authenticated`, habilitando bypass del flujo de aprobación.

### Evidencia (migración origen)
Archivo: `supabase/migrations/20260630260000_phase9_auth_roles_access.sql`
```sql
CREATE POLICY coordinator_requests_admin_update ON coordinator_requests
  FOR UPDATE TO authenticated
  USING (is_elevated_admin())
  WITH CHECK (is_elevated_admin());

GRANT SELECT, INSERT, UPDATE ON coordinator_requests TO authenticated;
```

### Solución implementada (mínimo impacto)
Nueva migración que:
- elimina `coordinator_requests_admin_update`
- revoca `UPDATE` en `coordinator_requests` para `authenticated`

### Archivos modificados
- `supabase/migrations/20260705014000_lockdown_coordinator_requests_update.sql`

### Migraciones
- `20260705014000_lockdown_coordinator_requests_update.sql`

### Riesgos de regresión
- Admins ya no podrán cambiar `status` vía REST; deberán usar RPCs (esperado).
- Cualquier código que use `.from('coordinator_requests').update(...)` fallará.

### Análisis automático de regresión
- No existe ningún `.from('coordinator_requests').update(...)` en el frontend.
- Las operaciones de aprobación/rechazo usan RPCs (`approve_coordinator_request`, `reject_coordinator_request`).
- Los RPCs internos (`request_coordinator_info`, `respond_coordinator_info`) actualizan `coordinator_requests` dentro de funciones SECURITY DEFINER y no dependen del UPDATE público.

### Pruebas necesarias (validación)
```bash
# 1. UPDATE directo con admin: debe fallar
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/coordinator_requests?id=eq.<REQUEST_ID>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_ADMIN>" \
  -H "Content-Type: application/json" \
  -X PATCH \
  -d '{"status":"approved"}'

# 2. RPC approve/reject: debe funcionar (SQL o SDK)
-- SDK:
supabase.rpc('approve_coordinator_request', { p_request_id: '<ID>', p_assigned_site_type: 'hospital', p_assigned_site_id: '<SITE>' })
supabase.rpc('reject_coordinator_request', { p_request_id: '<ID>', p_review_notes: '...' })

# 3. SQL: confirmar ausencia de policy
SELECT policyname FROM pg_policies
WHERE tablename = 'coordinator_requests' AND policyname = 'coordinator_requests_admin_update';
```

---

## A-01 — `is_admin()` basado en email JWT (allowlist `admin_emails`)

### ¿Cómo la explotaría un atacante real?
Un atacante registra una cuenta OAuth con un email presente en `admin_emails` antes que el admin real.  
Como `is_admin()` consultaba `admin_emails` vía JWT, el atacante obtenía permisos admin sin `profiles.role`.

### ¿Qué impacto tendría durante una emergencia nacional?
Acceso administrativo ilegítimo: eliminación de centros, remoción de coordinadores, acceso a perfiles y datos críticos, interrupción de operaciones.

### ¿Cuál es el parche mínimo?
Reescribir `is_admin()` para depender **solo** de roles en `profiles` (`is_elevated_admin()` / `is_super_admin()`), sin tocar arquitectura ni tablas.

### ¿Cómo demostramos que quedó cerrada?
1. Usuario con email en `admin_emails` pero sin rol → `is_admin()` retorna `false`.  
2. Usuario `regional_admin` / `super_admin` → `is_admin()` retorna `true`.  

### Causa raíz
`is_admin()` consultaba `admin_emails` con el email del JWT, que puede ser controlado por el atacante mediante registro OAuth.

### Evidencia (migración origen)
Archivo: `supabase/migrations/20260630260000_phase9_auth_roles_access.sql`
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  OR is_elevated_admin()
  OR is_super_admin();
$$;
```

### Solución implementada (mínimo impacto)
Nueva migración que redefine `is_admin()` sin consultar `admin_emails`.

### Archivos modificados
- `supabase/migrations/20260705010000_fix_is_admin_email_bypass.sql`

### Migraciones
- `20260705010000_fix_is_admin_email_bypass.sql`

### Riesgos de regresión
- Usuarios que solo estaban en `admin_emails` sin rol en `profiles` perderán permisos admin.
- Requiere confirmar que los emails bootstrap ya tienen `profiles.role = 'super_admin'`.

### Análisis automático de regresión
- No existe lógica de frontend que consulte `admin_emails` directamente.
- Los flujos admin usan roles (`profiles.role`), no el allowlist.
- Las funciones con guard `is_admin()` seguirán funcionando para admins reales.

### Pruebas necesarias (validación)
```sql
-- 1. Usuario con email en admin_emails pero sin rol
SELECT is_admin(); -- Esperado: false

-- 2. Usuario regional_admin
SELECT is_admin(); -- Esperado: true

-- 3. Usuario super_admin
SELECT is_admin(); -- Esperado: true

-- 4. Verificar bootstrap histórico
SELECT ae.email, p.role
FROM admin_emails ae
LEFT JOIN profiles p ON lower(p.email) = lower(ae.email);
```

---

## A-06 — Rate limiting bypasseable vía `X-Forwarded-For` spoofing

### ¿Cómo la explotaría un atacante real?
Un bot alterna `X-Forwarded-For` en cada request y elude los límites por IP:

```bash
curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "apikey: <ANON_KEY>" \
  -H "X-Forwarded-For: 10.0.0.1" \
  -d '{...}'

curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "apikey: <ANON_KEY>" \
  -H "X-Forwarded-For: 10.0.0.2" \
  -d '{...}'
```

### ¿Qué impacto tendría durante una emergencia nacional?
Spam masivo de reportes y solicitudes de coordinador, saturando a admins, degradando la señal operacional y consumiendo recursos.

### ¿Cuál es el parche mínimo?
Reescribir `security_client_ip()` para **no usar headers controlables** y tomar IP derivada del servidor (`request.ip` o `inet_client_addr()`).

### ¿Cómo demostramos que quedó cerrada?
1. Repetir requests con diferentes `X-Forwarded-For` debe contar como el mismo actor.  
2. El límite se aplica y se recibe `rate_limit_exceeded`.  

### Causa raíz
`security_client_ip()` confía en `x-forwarded-for` / `x-real-ip`, que el cliente puede falsificar.

### Evidencia (migración origen)
Archivo: `supabase/migrations/20260630270000_security_hardening.sql`
```sql
v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
IF v_ip IS NULL THEN
  v_ip := nullif(trim(coalesce(v_headers ->> 'x-real-ip', '')), '');
END IF;
```

### Solución implementada (mínimo impacto)
Nueva migración que redefine `security_client_ip()` usando `request.ip` y `inet_client_addr()` en vez de headers.

### Archivos modificados
- `supabase/migrations/20260705015000_harden_rate_limit_actor_ip.sql`

### Migraciones
- `20260705015000_harden_rate_limit_actor_ip.sql`

### Riesgos de regresión
- Usuarios detrás de NAT comparten cuota por IP real (más estricto).
- Si `request.ip` no está disponible en el entorno, se usará `inet_client_addr()`; en algunos despliegues puede resolverse a IP del proxy y agrupar tráfico.

### Análisis automático de regresión
- No existe dependencia explícita en headers `X-Forwarded-For` o `x-real-ip` en el resto del código.
- El rate limit para usuarios autenticados sigue usando `auth.uid()` (no cambia).

### Pruebas necesarias (validación)
```bash
# 1. Enviar múltiples requests con X-Forwarded-For distinto
# Debe contar como el mismo actor y bloquear tras superar límite

curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "apikey: <ANON_KEY>" \
  -H "X-Forwarded-For: 10.0.0.1" \
  -d '{...}'

curl -s "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/reports" \
  -H "apikey: <ANON_KEY>" \
  -H "X-Forwarded-For: 10.0.0.2" \
  -d '{...}'

# 2. SQL: comprobar actor_key para un usuario anon
SELECT security_actor_key();
```

---

## A-10 — Múltiples coordinadores por sitio

### ¿Cómo la explotaría un atacante real?
Un admin comprometido aprueba dos solicitudes distintas con el mismo `site_id`.  
El sistema acepta ambas y deja **dos coordinadores activos** sobre el mismo centro.

### ¿Qué impacto tendría durante una emergencia nacional?
Conflictos de autoridad sobre inventario y reportes.  
Decisiones contradictorias en el mismo sitio, con pérdida de trazabilidad operativa.

### ¿Cuál es el parche mínimo?
Imponer unicidad **solo para coordinadores activos**:
`UNIQUE (site_type, site_id) WHERE onboarding_complete = true`.

### ¿Cómo demostramos que quedó cerrada?
1. Intentar aprobar dos coordinadores activos para el mismo sitio → el segundo debe fallar por UNIQUE.  
2. Un coordinador en onboarding puede coexistir, pero no dos activos.

### Causa raíz
La tabla `coordinator_profiles` no tiene constraint UNIQUE en `(site_type, site_id)`; solo `auth_user_id` es único.

### Evidencia (migración origen)
Archivo: `supabase/migrations/20260628160000_coordinator_sites_and_cleanup.sql`
```sql
auth_user_id UUID NOT NULL UNIQUE,
...
CREATE INDEX IF NOT EXISTS idx_coordinator_profiles_site ON coordinator_profiles(site_type, site_id);
```

### Solución implementada (mínimo impacto)
Nueva migración que añade índice UNIQUE parcial para coordinadores activos.

### Archivos modificados
- `supabase/migrations/20260705017000_unique_active_coordinator_per_site.sql`

### Migraciones
- `20260705017000_unique_active_coordinator_per_site.sql`

### Riesgos de regresión
- Si ya existen dos coordinadores activos para el mismo sitio, la migración fallará.  
- Requiere limpieza previa si hay duplicados activos.

### Análisis automático de regresión
- Frontend y hooks usan `.maybeSingle()` por `auth_user_id`, no por sitio.
- Ningún flujo depende explícitamente de múltiples coordinadores por sitio.
- RPCs crean un solo coordinador activo por solicitud; el UNIQUE solo afecta duplicados simultáneos.

### Pruebas necesarias (validación)
```sql
-- 1. Detectar duplicados activos antes de aplicar
SELECT site_type, site_id, count(*)
FROM coordinator_profiles
WHERE onboarding_complete = true
GROUP BY site_type, site_id
HAVING count(*) > 1;

-- 2. Intentar segundo coordinador activo para mismo sitio (debe fallar)
INSERT INTO coordinator_profiles (auth_user_id, site_type, site_id, onboarding_complete)
VALUES ('<USER_1>', 'hospital', '<SITE>', true);
INSERT INTO coordinator_profiles (auth_user_id, site_type, site_id, onboarding_complete)
VALUES ('<USER_2>', 'hospital', '<SITE>', true);
```

---

## A-02 — `approve_coordinator_request` no valida sitio asignado

### ¿Cómo la explotaría un atacante real?
Un admin comprometido (o acceso elevado robado) puede aprobar una solicitud asignando un `site_id` inexistente o de tipo incorrecto.  
Esto crea coordinadores con centros inválidos o sin centro real.

### ¿Qué impacto tendría durante una emergencia nacional?
Coordinadores asignados a centros inexistentes, solicitudes aprobadas sin capacidad operativa real.  
Puede dejar centros reales sin coordinador o provocar decisiones erróneas de distribución.

### ¿Cuál es el parche mínimo?
Agregar `assert_valid_site_reference(p_assigned_site_type, p_assigned_site_id)` dentro de `approve_coordinator_request`.

### ¿Cómo demostramos que quedó cerrada?
1. Aprobar con `site_id` inexistente debe fallar con `site_not_found`.  
2. Aprobar con tipo inválido debe fallar con `invalid_site_type`.  
3. Aprobar con sitio válido debe seguir funcionando.

### Causa raíz
La función `approve_coordinator_request` actualiza `assigned_site_type` y `assigned_site_id` sin validar que el sitio exista.

### Evidencia (migraciones / funciones)
Archivo: `supabase/migrations/20260630264000_coordinator_decision_notifications.sql`
```sql
UPDATE coordinator_requests
SET status = 'approved',
    assigned_site_type = p_assigned_site_type,
    assigned_site_id = p_assigned_site_id
WHERE id = p_request_id;
```

Archivo: `supabase/migrations/20260630270000_security_hardening.sql`
```sql
CREATE OR REPLACE FUNCTION assert_valid_site_reference(p_site_type TEXT, p_site_id UUID) ...
```

### Solución implementada (mínimo impacto)
Nueva migración que redefine `approve_coordinator_request` y valida el sitio con `assert_valid_site_reference(...)`.

### Archivos modificados
- `supabase/migrations/20260705016000_validate_assigned_site_on_approve.sql`

### Migraciones
- `20260705016000_validate_assigned_site_on_approve.sql`

### Riesgos de regresión
- Aprobaciones con sitio incorrecto ahora fallarán (esperado).
- Flujos legítimos no se rompen si el admin asigna un sitio válido.

### Análisis automático de regresión
- El frontend usa exclusivamente el RPC `approve_coordinator_request` (no hay UPDATE directo).
- Los sitios válidos ya existen en `hospitals`, `shelters`, `supply_centers`.
- No hay otros módulos que dependan de asignar IDs inexistentes.

### Pruebas necesarias (validación)
```bash
# 1. Aprobar con site inexistente: debe fallar
supabase.rpc('approve_coordinator_request', {
  p_request_id: '<REQUEST_ID>',
  p_assigned_site_type: 'hospital',
  p_assigned_site_id: '00000000-0000-0000-0000-000000000000'
})

# 2. Aprobar con tipo inválido: debe fallar
supabase.rpc('approve_coordinator_request', {
  p_request_id: '<REQUEST_ID>',
  p_assigned_site_type: 'invalid_type',
  p_assigned_site_id: '<SITE_UUID>'
})

# 3. Aprobar con sitio válido: debe funcionar
supabase.rpc('approve_coordinator_request', {
  p_request_id: '<REQUEST_ID>',
  p_assigned_site_type: 'hospital',
  p_assigned_site_id: '<SITE_UUID>'
})
```

---

## A-03 — `approve_coordinator_request` degrada rol de admins

### ¿Cómo la explotaría un atacante real?
Un admin comprometido aprueba una solicitud de un usuario que ya es `regional_admin` o `super_admin`.  
El RPC sobrescribe su `profiles.role` con `coordinator`.

### ¿Qué impacto tendría durante una emergencia nacional?
Pérdida de privilegios administrativos en plena crisis, bloqueando acciones críticas (aprobaciones, auditoría, eliminación de centros).

### ¿Cuál es el parche mínimo?
Preservar roles superiores en el `ON CONFLICT DO UPDATE`:
```sql
SET role = CASE
  WHEN profiles.role IN ('regional_admin','super_admin') THEN profiles.role
  ELSE 'coordinator'
END
```

### ¿Cómo demostramos que quedó cerrada?
1. Usuario `regional_admin` aprobado como coordinador mantiene su rol.  
2. Usuario normal sigue pasando a `coordinator`.

### Causa raíz
El `ON CONFLICT DO UPDATE` en `approve_coordinator_request` fuerza `role = 'coordinator'` sin verificar rol previo.

### Evidencia (migraciones)
`supabase/migrations/20260705016000_validate_assigned_site_on_approve.sql`
```sql
ON CONFLICT (id) DO UPDATE
  SET role = 'coordinator',
      full_name = EXCLUDED.full_name,
      status = 'active',
      updated_at = now();
```

### Solución implementada (mínimo impacto)
Nueva migración que redefine `approve_coordinator_request` preservando roles admin.

### Archivos modificados
- `supabase/migrations/20260705018000_preserve_admin_role_on_approve.sql`

### Migraciones
- `20260705018000_preserve_admin_role_on_approve.sql`

### Riesgos de regresión
- Un admin que realmente quiera ser “solo coordinador” mantendrá rol admin (esperado).

### Resultado del análisis de regresión
- Frontend usa RPC `approve_coordinator_request`; sin cambios de interfaz.
- No hay flujos que dependan de degradar admins.

### Pruebas de validación
```sql
-- 1. Admin regional aprobado → mantiene rol
SELECT role FROM profiles WHERE id = '<ADMIN_ID>'; -- regional_admin
-- Ejecutar approve_coordinator_request
SELECT role FROM profiles WHERE id = '<ADMIN_ID>'; -- debe seguir regional_admin

-- 2. Usuario normal → pasa a coordinator
SELECT role FROM profiles WHERE id = '<USER_ID>'; -- citizen
-- Ejecutar approve_coordinator_request
SELECT role FROM profiles WHERE id = '<USER_ID>'; -- coordinator
```

---

## A-08 — Realtime activo en `profiles` y `coordinator_profiles`

### Solución implementada (mínimo impacto)
Eliminar ambas tablas del publication `supabase_realtime`.

### Migraciones
- `20260705019000_disable_profile_realtime.sql`

### Riesgos de regresión
- El `auth-context` usa Realtime para refrescar el rol tras aprobación.
- Sin publicación, el cambio de rol puede requerir refresh manual o polling.

### Resultado del análisis de regresión
- `src/store/auth-context.tsx` se suscribe a `profiles` y `coordinator_profiles`.
- No hay otros usos directos de Realtime sobre estas tablas.

### Pruebas de validación
```sql
-- Verificar que no están en la publicación
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('profiles', 'coordinator_profiles');
```

---

## A-11 — `validate_need_write` no verifica pertenencia

### Solución implementada (mínimo impacto)
Agregar verificación de ownership en el trigger para usuarios autenticados no admin.

### Migraciones
- `20260705020000_validate_need_write_ownership.sql`

### Riesgos de regresión
- Coordinadores sin `onboarding_complete` no podrán crear/editar needs.
- En legacy frontend, las inserciones `needs` fallarán si el usuario no es coordinador real.

### Resultado del análisis de regresión
- `src/repositories/need-repository.ts` y `legacy-frontend/src/hooks/useQuickUpdate.ts` usan INSERT/UPDATE en `needs`.
- Ambos flujos dependen de permisos de coordinador; el check refuerza lo esperado.

### Pruebas de validación
```sql
-- Usuario no coordinador: debe fallar
INSERT INTO needs (needable_type, needable_id, item_name, unit, qty_required)
VALUES ('hospital', '<SITE>', 'Agua', 'unidades', 10);

-- Coordinador del sitio: debe funcionar
```

---

## A-12 — `regional_admin_insert_*` sin `status = 'active'`

### Solución implementada (mínimo impacto)
Recrear políticas `regional_admin_insert_*` con `status = 'active'`.

### Migraciones
- `20260705021000_restore_admin_insert_status_active.sql`

### Riesgos de regresión
- Inserciones con status distinto a `active` fallarán (esperado).

### Resultado del análisis de regresión
- No hay inserciones directas a `hospitals/shelters/supply_centers` en `src`.
- El registro de centros usa RPC `admin_register_center`.

### Pruebas de validación
```sql
-- Inserción con status distinto: debe fallar
INSERT INTO hospitals (name, status) VALUES ('Test', 'inactive');

-- Inserción con status active: debe funcionar para admins
INSERT INTO hospitals (name, status) VALUES ('Test', 'active');
```
