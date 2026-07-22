# DEPLOYMENT_VERIFICATION_REPORT

Fecha: 2026-07-05  
Entorno verificado: `https://gfngmbbotqzzchjzgajo.supabase.co`  
Método: pruebas HTTP/RPC contra runtime + comparación con migraciones del repositorio.

## Resumen ejecutivo

Se detectaron discrepancias críticas entre lo esperado en repositorio y el comportamiento runtime:
- Edge Function de push acepta requests sin secret (`200 skipped`) en lugar de rechazar (`401/500`) -> **despliegue/config no alineado**.
- RPC `notify_coordinator_request_user` y `log_auth_event` se ejecutan con token anon (retornan error de FK en vez de permission denied) -> **grants efectivos no alineados**.

Veredicto: **NO GO**.

## Tabla Repo vs Runtime

| Control | Repo (esperado) | Runtime (evidencia) | Estado |
|---|---|---|---|
| Migraciones aplicadas (`schema_migrations`) | Consultable por SQL admin | `GET /rest/v1/schema_migrations` -> 404 (no expuesto) | No verificable por API anon |
| Policies RLS efectivas (catalog) | Revisables con `pg_policies` | `GET /rest/v1/pg_policies` -> 404 (no expuesto) | No verificable por API anon |
| C-04 REVOKE `notify_coordinator_request_user` | Debe negar ejecución a anon/auth | `POST /rpc/notify_coordinator_request_user` -> 409 FK (ejecutó función) | **Discrepancia crítica** |
| C-05 REVOKE `log_auth_event` | Debe negar ejecución a anon/auth | `POST /rpc/log_auth_event` -> 409 FK (ejecutó función) | **Discrepancia crítica** |
| A-04 bloqueo insert `events` | Sin INSERT para anon/auth | `POST /events` anon -> 401 permission denied | OK |
| C-03 push secret obligatorio | Sin secret debe 401/500 | `POST /functions/v1/send-notification-push` sin secret -> 200 `{\"skipped\":true}` | **Discrepancia crítica** |
| A-05 lectura pública `persons` | Anon no debería leer PII | `GET /persons?limit=1` -> 200 `[]` | Inconcluso (dataset vacío/filtro) |
| Storage buckets públicos | Deben estar privados | `GET /storage/v1/bucket` anon -> 200 `[]` | Inconcluso (permiso/listado oculto) |
| Realtime publications (`profiles`,`coordinator_profiles`) | Deben estar removidas (A-08) | Requiere SQL admin (`pg_publication_tables`) | No verificable por API anon |
| Triggers activos | Validables por efecto o SQL admin | Solo validación parcial por errores de negocio | Parcial |

## Hallazgos

1. **Edge Function no alineada (C-03)**
   - Repo: `send-notification-push` exige `PUSH_WEBHOOK_SECRET`.
   - Runtime: request sin secret devuelve 200 y procesa flujo.
   - Riesgo: endpoint invocable sin autenticación fuerte.
   - Causa probable: función no desplegada con última versión o variable/branch incorrecta.
   - Evidencia: `POST /functions/v1/send-notification-push` -> `200 {"skipped":true,"reason":"push_disabled"}`.

2. **Permisos RPC no alineados (C-04/C-05)**
   - Repo: REVOKE a `authenticated` + hardening adicional de notify.
   - Runtime: llamadas con token anon ejecutan cuerpo de función (fallan por FK, no por permisos).
   - Riesgo: abuso de notificaciones y auditoría.
   - Causa probable: migraciones de seguridad no aplicadas completamente en entorno remoto.
   - Evidencia:
     - `POST /rpc/notify_coordinator_request_user` -> 409 FK `notifications_user_id_fkey`.
     - `POST /rpc/log_auth_event` -> 409 FK `auth_audit_logs_target_user_id_fkey`.

3. **Falta de visibilidad administrativa de metadatos de despliegue**
   - No se pudo comprobar `schema_migrations`, `pg_policies`, `pg_proc`, `pg_publication_tables` por API anon.
   - Riesgo: no se puede certificar parity repo/runtime sin acceso SQL admin.

## Riesgos

- Persistencia de vulnerabilidades críticas C-03/C-04/C-05 en producción.
- Riesgo de explotación remota sin autenticación privilegiada.
- Validación incompleta de A-05/A-07/A-08/A-10/A-11/A-12 por falta de acceso admin runtime.

## Checklist de despliegue pendiente

- [ ] Confirmar versión desplegada de `send-notification-push` (hash/fecha) y redeploy si difiere.
- [ ] Confirmar `PUSH_WEBHOOK_SECRET` en runtime de funciones y header en webhook origen.
- [ ] Verificar grants efectivos:
  - [ ] `has_function_privilege('anon', notify_coordinator_request_user, 'EXECUTE') = false`
  - [ ] `has_function_privilege('authenticated', notify_coordinator_request_user, 'EXECUTE') = false`
  - [ ] `has_function_privilege('anon', log_auth_event, 'EXECUTE') = false`
  - [ ] `has_function_privilege('authenticated', log_auth_event, 'EXECUTE') = false`
- [ ] Verificar migraciones aplicadas en `supabase_migrations.schema_migrations` para todos los archivos `2026070500*.sql`.
- [ ] Verificar realtime publication actual (`profiles`, `coordinator_profiles` fuera de `supabase_realtime`).
- [ ] Verificar estado real de buckets y policies de storage con SQL admin.

## Veredicto final

**NO GO**  
Base técnica: discrepancias críticas demostradas entre comportamiento runtime y controles definidos en repositorio (C-03, C-04, C-05).
