<!-- FARO P0 Security Remediation (Criticals only) -->

# FARO — Remediación P0 (Críticos)

**Fecha:** 4–5 de julio de 2026  
**Alcance:** Solo C-01 a C-05 del `SECURITY_AUDIT_PHASE_1.md`  
**Estado:** Cambios implementados en código y migraciones; pendientes de aplicar en Supabase.  

---

## C-01 — Escalada de privilegios modificando `profiles.role`

**Causa raíz**  
- RLS `profiles_update_own` permite UPDATE de cualquier columna cuando `id = auth.uid()`.  
- No existe trigger que bloquee cambios a `role` o `status`.

**Solución implementada**  
- Trigger `guard_profile_role_changes` bloquea cambios de `role` salvo `is_super_admin()`; y `status` salvo `is_elevated_admin()`.

**Archivos modificados**  
- `supabase/migrations/20260705001000_security_p0_critical_fixes.sql`

**Migraciones creadas**  
- `20260705001000_security_p0_critical_fixes.sql`

**Riesgos de compatibilidad**  
- Usuarios no podrán cambiar `role` o `status` mediante actualizaciones directas (esperado).  
- Actualizaciones legítimas deben ir por RPCs admin.

**Evidencia de no explotabilidad (regresión)**  
- Pendiente de ejecutar en Supabase (ver sección “Pruebas ejecutadas”).

---

## C-02 — Autoasignación de `coordinator_profiles`

**Causa raíz**  
- Políticas `coordinator_profiles_insert_own` y `coordinator_profiles_update_own` permiten que cualquier usuario inserte o modifique su fila, sin validación del `site_id`.

**Solución implementada**  
- Eliminadas políticas de self-insert/update.  
- Nuevas políticas `coordinator_profiles_admin_insert` y `coordinator_profiles_admin_update` restringidas a `is_elevated_admin()`.

**Archivos modificados**  
- `supabase/migrations/20260705001000_security_p0_critical_fixes.sql`

**Migraciones creadas**  
- `20260705001000_security_p0_critical_fixes.sql`

**Riesgos de compatibilidad**  
- Coordinadores ya no pueden autoasignarse; toda asignación debe pasar por RPCs de aprobación/admin (modelo esperado).

**Evidencia de no explotabilidad (regresión)**  
- Pendiente de ejecutar en Supabase (ver sección “Pruebas ejecutadas”).

---

## C-03 — Edge Function de Push accesible sin autenticación

**Causa raíz**  
- `verify_jwt = false` en `supabase/config.toml` y la función no valida ningún header secreto.

**Solución implementada**  
- Se exige `PUSH_WEBHOOK_SECRET` y header `x-faro-webhook-secret` en cada request.  
- Si no existe el secreto o no coincide, responde 500/401.

**Archivos modificados**  
- `supabase/functions/send-notification-push/index.ts`

**Migraciones creadas**  
- Ninguna (cambio de Edge Function + configuración de secret en Supabase).

**Riesgos de compatibilidad**  
- El webhook de Supabase debe incluir `x-faro-webhook-secret`.  
- Si el secret no se configura, la función bloqueará todos los envíos (fail-closed).

**Evidencia de no explotabilidad (regresión)**  
- Pendiente de ejecutar en Supabase (ver sección “Pruebas ejecutadas”).

---

## C-04 — RPC `notify_coordinator_request_user` accesible por usuarios autenticados

**Causa raíz**  
- `GRANT EXECUTE ... TO authenticated` sin validación de rol.

**Solución implementada**  
- `REVOKE EXECUTE` para `authenticated`.

**Archivos modificados**  
- `supabase/migrations/20260705001000_security_p0_critical_fixes.sql`

**Migraciones creadas**  
- `20260705001000_security_p0_critical_fixes.sql`

**Riesgos de compatibilidad**  
- Llamadas directas desde cliente quedan bloqueadas (esperado).  
- Las llamadas internas desde otras funciones SECURITY DEFINER siguen funcionando.

**Evidencia de no explotabilidad (regresión)**  
- Pendiente de ejecutar en Supabase (ver sección “Pruebas ejecutadas”).

---

## C-05 — RPC `log_auth_event` accesible por usuarios autenticados

**Causa raíz**  
- `GRANT EXECUTE ... TO authenticated` sin validación de rol.

**Solución implementada**  
- `REVOKE EXECUTE` para `authenticated`.

**Archivos modificados**  
- `supabase/migrations/20260705001000_security_p0_critical_fixes.sql`

**Migraciones creadas**  
- `20260705001000_security_p0_critical_fixes.sql`

**Riesgos de compatibilidad**  
- Clientes ya no pueden escribir logs manualmente (esperado).  
- Uso interno por RPCs SECURITY DEFINER permanece operativo.

**Evidencia de no explotabilidad (regresión)**  
- Pendiente de ejecutar en Supabase (ver sección “Pruebas ejecutadas”).

---

## Tabla resumen

| Vulnerabilidad | Estado | Verificada |
|----------------|--------|------------|
| C-01 | Corregida | ⏳ |
| C-02 | Corregida | ⏳ |
| C-03 | Corregida | ⏳ |
| C-04 | Corregida | ⏳ |
| C-05 | Corregida | ⏳ |

---

## Pruebas ejecutadas

**Pendientes** — no se ejecutaron porque no hay acceso directo a Supabase CLI ni credenciales de despliegue/SQL desde este entorno.  

Se requiere:\n
1. Aplicar la migración `20260705001000_security_p0_critical_fixes.sql` en Supabase.  
2. Desplegar la Edge Function `send-notification-push` con la nueva validación de secret.  
3. Configurar `PUSH_WEBHOOK_SECRET` en Supabase Functions env vars y en el webhook correspondiente.

### Pruebas de regresión requeridas (scripts preparados)

**C-01** — intento de `UPDATE profiles.role` con JWT de usuario normal debe fallar con `role_change_forbidden`.  
**C-02** — intento de INSERT en `coordinator_profiles` por usuario normal debe fallar por RLS.  
**C-03** — POST a Edge Function sin `x-faro-webhook-secret` debe responder 401.  
**C-04** — RPC `notify_coordinator_request_user` debe fallar con error de permisos.  
**C-05** — RPC `log_auth_event` debe fallar con error de permisos.

---

## Riesgos residuales (solo P0)

- Puntos no críticos (Alta/Media/Baja) siguen abiertos y no se tocaron por solicitud explícita.  
- C-03 no cubre replay/idempotencia: aún depende de mejoras de severidad Media (M-13).

