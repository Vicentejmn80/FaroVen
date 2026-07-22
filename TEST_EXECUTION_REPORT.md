# TEST_EXECUTION_REPORT

## Resumen ejecutivo

Se ejecutó la certificación automática de FARO basada en `PRODUCTION_CERTIFICATION_PLAN.md` sobre:
- pipeline local (`build`, `lint`, checks de conectividad),
- runtime Supabase (RLS, RPC, triggers, storage, realtime, edge),
- API pública (lecturas, inserciones anónimas),
- evidencia operativa (logs de edge function y source deployado).

Resultado general: **NO GO**.

Motivo objetivo: existen controles de seguridad críticos con evidencia de fallo en runtime (principalmente C-03, C-04, C-05), además de regresiones funcionales detectables en pruebas automáticas.

---

## Métricas de ejecución

- Total de pruebas: **45**
- PASS: **24**
- FAIL: **14**
- BLOCKED: **7**
- Tiempo de ejecución (comandos automáticos): **00:03:23** (203163 ms acumulados en shell)
- Tiempo total de validación (incluyendo consultas runtime): **~00:10**

Cobertura ejecutada:
- Seguridad: ejecutada (parcial por falta de credenciales de roles internos)
- Funcionalidad/API pública: ejecutada
- RPC: ejecutada
- Edge Functions: ejecutada
- RLS/Policies/Grants: ejecutada
- Storage: ejecutada (lectura/listado; upload autenticado bloqueado)
- Realtime: ejecutada (estado publication); validación live bloqueada
- Triggers: ejecutada (presencia + efecto indirecto)
- Auditoría: ejecutada (RPC y grants)
- Roles: ejecutada (grants + políticas; validación por JWT de roles bloqueada)
- Notificaciones/Push: ejecutada (RPC + edge + logs; entrega real push bloqueada)
- Needs/Personas/Reportes/Inventario/Centros/Coordinadores: ejecutada (parcial en rutas anónimas + metadatos runtime)

---

## Resultados detallados por prueba

| ID | Descripción | Resultado esperado | Resultado obtenido | Estado | Evidencia | Archivo afectado | Impacto | Prioridad | Cómo reproducir |
|---|---|---|---|---|---|---|---|---|---|
| T-001 | Root build | Build exitoso | `npm run build` OK | PASS | salida Vite/TSC exit 0 | `package.json` | Confirma compilación | Alta | `cd FARO && npm run build` |
| T-002 | Root lint | Lint ejecutable | `eslint` no encontrado | FAIL | `"eslint" no se reconoce...` | `package.json` | Sin gate de calidad local | Media | `cd FARO && npm run lint` |
| T-003 | Frontend build | Build exitoso | `frontend` build OK | PASS | Vite build exit 0 | `frontend/package.json` | Confirma compilación frontend | Alta | `cd frontend && npm run build` |
| T-004 | Frontend lint | Lint ejecutable | `eslint` no encontrado | FAIL | `"eslint" no se reconoce...` | `frontend/package.json` | Sin gate de calidad frontend | Media | `cd frontend && npm run lint` |
| T-005 | Check Supabase core | Checks básicos OK | Falla `reports_insert_permission` por RLS | FAIL | script `check-supabase-core.mjs` exit 1 | `frontend/scripts/check-supabase-core.mjs` | Regresión en smoke test runtime | Alta | `cd frontend && node scripts/check-supabase-core.mjs` |
| T-006 | Tablas runtime públicas | Tablas críticas presentes con RLS | 28 tablas listadas con `rls_enabled=true` | PASS | MCP `list_tables` | DB runtime | Base de datos cargada y protegida por RLS | Alta | MCP `list_tables` |
| T-007 | list_migrations MCP | Migraciones listadas | `migrations: []` | FAIL | MCP `list_migrations` | Runtime metadata | No trazabilidad de migraciones por ese método | Media | MCP `list_migrations` |
| T-008 | Historial schema_migrations | Tabla accesible | `relation ... does not exist` | FAIL | `execute_sql` error 42P01 | Runtime metadata | No evidencia SQL de versiones aplicadas | Alta | `select ... from supabase_migrations.schema_migrations` |
| T-009 | Edge function desplegada | Función presente | `send-notification-push` ACTIVE v2 | PASS | MCP `list_edge_functions` | `supabase/functions/send-notification-push/index.ts` (deploy) | Confirma despliegue activo | Alta | MCP `list_edge_functions` |
| T-010 | Edge verify_jwt | endurecido acorde hardening | `verify_jwt=false` | FAIL | MCP metadata función | Edge runtime | Endpoint expuesto a llamadas sin JWT | Crítica | MCP `list_edge_functions` |
| T-011 | Edge secreto ausente | 401/500 | HTTP 200 `{"skipped":true}` | FAIL | probe `EDGE_NO_SECRET` | Edge runtime | C-03 abierto | Crítica | POST `/functions/v1/send-notification-push` sin header |
| T-012 | Edge secreto incorrecto | 401 | HTTP 200 `{"skipped":true}` | FAIL | probe `EDGE_WRONG_SECRET` | Edge runtime | C-03 abierto | Crítica | POST con `x-faro-webhook-secret: invalid-secret` |
| T-013 | Logs edge operativos | Registro de invocaciones | múltiples `POST | 200` | PASS | MCP `get_logs(edge-function)` | Edge runtime | Evidencia de ejecución real | Media | MCP `get_logs` service `edge-function` |
| T-014 | RPC notify (anon) | permiso denegado | RPC ejecuta y falla por FK (409) | FAIL | `RPC_NOTIFY_ANON` | RPC `notify_coordinator_request_user` | C-04 abierto (ejecutable sin bloqueo efectivo) | Crítica | POST `/rest/v1/rpc/notify_coordinator_request_user` con anon key |
| T-015 | RPC log_auth_event (anon) | permiso denegado | RPC ejecuta y falla por FK (409) | FAIL | `RPC_LOG_AUTH_ANON` | RPC `log_auth_event` | C-05 abierto (ejecutable sin bloqueo efectivo) | Crítica | POST `/rest/v1/rpc/log_auth_event` con anon key |
| T-016 | Insert manual en events (anon) | denegado | 401 permission denied | PASS | `EVENTS_INSERT_ANON` | tabla `events` | A-04 efectivo | Alta | POST `/rest/v1/events` con anon key |
| T-017 | Insert coordinator_profiles (anon) | denegado | 401 RLS violation | PASS | `COORD_PROFILES_INSERT_ANON` | tabla `coordinator_profiles` | C-02 efectivo en ruta anon | Alta | POST `/rest/v1/coordinator_profiles` |
| T-018 | Política persons pública | no debe existir | `public_read_persons` existe | FAIL | `pg_policies` runtime | tabla `persons` | A-05 abierto | Alta | `select ... from pg_policies where tablename='persons'` |
| T-019 | Buckets privados | `public=false` | `reports-images=false`, `person-lists=false` | PASS | SQL `storage.buckets` | storage buckets | A-07 parcial OK (flag bucket) | Alta | `select id, public from storage.buckets ...` |
| T-020 | Policies storage.objects | acceso restringido | policies solo `{authenticated}` | PASS | `pg_policies` esquema `storage` | storage policies | Refuerzo de acceso a objetos | Alta | `select ... from pg_policies where schemaname='storage'` |
| T-021 | Realtime profiles | fuera de publication | `profiles` sigue en `supabase_realtime` | FAIL | `pg_publication_tables` | realtime publication | A-08 abierto | Alta | `select ... from pg_publication_tables` |
| T-022 | Realtime coordinator_profiles | fuera de publication | `coordinator_profiles` sigue en publication | FAIL | `pg_publication_tables` | realtime publication | A-08 abierto | Alta | `select ... from pg_publication_tables` |
| T-023 | Update coordinator_requests (grant authenticated) | revocado | `has_table_privilege(... UPDATE)=false` | PASS | SQL grants | tabla `coordinator_requests` | A-09 (grant) aplicado | Alta | `has_table_privilege('authenticated',...)` |
| T-024 | Índice único coordinador activo por sitio | presente | no existe índice esperado | FAIL | `pg_indexes` vacío | `coordinator_profiles` | A-10 abierto | Alta | `select ... from pg_indexes ... active_coordinator_per_site` |
| T-025 | validate_need_write con ownership | ownership check presente | definición sin check de ownership | FAIL | `pg_get_functiondef(validate_need_write)` | trigger function `validate_need_write` | A-11 abierto | Alta | `select pg_get_functiondef('public.validate_need_write()'::regprocedure)` |
| T-026 | Policy admin insert status active | enforce `status='active'` | `with_check = is_elevated_admin()` sin status | FAIL | `pg_policies` qual/with_check | policies `regional_admin_insert_*` | A-12 abierto | Alta | `select policyname, with_check ...` |
| T-027 | is_admin email bypass | no referenciar `admin_emails` | no referencia `admin_emails` | PASS | `pg_get_functiondef(is_admin)` | función `is_admin` | A-01 mitigado | Alta | `select pg_get_functiondef('public.is_admin()'::regprocedure)` |
| T-028 | approve valida sitio asignado | debe validar | contiene `assert_valid_site_reference` | PASS | definición `approve_coordinator_request` | RPC approve | A-02 mitigado en código runtime | Alta | `select pg_get_functiondef('public.approve_coordinator_request(...)'::regprocedure)` |
| T-029 | approve preserva rol admin | no downgrade admin | `CASE WHEN profiles.role IN ('regional_admin','super_admin')` presente | PASS | definición runtime | RPC approve | A-03 mitigado en código runtime | Alta | misma consulta de T-028 |
| T-030 | Rate-limit IP source | no `x-forwarded-for` spoofable | `request.ip=true`, `x-forwarded-for=false` | PASS | SQL `security_client_ip` | función `security_client_ip` | A-06 mitigado | Alta | `pg_get_functiondef(security_client_ip)` |
| T-031 | Lectura pública hospitales | accesible | 200 con datos | PASS | `PUBLIC_HOSPITALS` | tabla `hospitals` | Funcionalidad pública OK | Media | GET `/rest/v1/hospitals?select=id,name&limit=1` |
| T-032 | Lectura pública shelters | accesible | 200 con datos | PASS | `PUBLIC_SHELTERS` | tabla `shelters` | Funcionalidad pública OK | Media | GET `/rest/v1/shelters?...` |
| T-033 | Lectura pública supply_centers | accesible | 200 con datos | PASS | `PUBLIC_SUPPLY_CENTERS` | tabla `supply_centers` | Funcionalidad pública OK | Media | GET `/rest/v1/supply_centers?...` |
| T-034 | Lectura pública needs | accesible | 200 con datos | PASS | `PUBLIC_NEEDS` | tabla `needs` | Funcionalidad pública OK | Media | GET `/rest/v1/needs?...` |
| T-035 | Lectura pública events | accesible | 200 con datos | PASS | `PUBLIC_EVENTS` | tabla `events` | Timeline pública OK | Media | GET `/rest/v1/events?...` |
| T-036 | Lectura pública reports | accesible | 200 con datos | PASS | `PUBLIC_REPORTS` | tabla `reports` | Reportes visibles según diseño actual | Media | GET `/rest/v1/reports?...` |
| T-037 | Lectura pública persons | debería estar restringida | 200 (lista vacía) | FAIL | `PUBLIC_PERSONS` + policy pública existente | tabla `persons` | A-05 abierto (exposición por policy) | Alta | GET `/rest/v1/persons?...` |
| T-038 | Insert anónimo de reporte | crear reporte sin romper pipeline | 409 FK en `notifications_user_id_fkey` | FAIL | `ANON_INSERT_REPORT` | trigger `notify_on_citizen_report` / tabla `notifications` | Regresión funcional en flujo de reporte | Alta | POST `/rest/v1/reports` con payload válido |
| T-039 | Update coordinator_requests (anon) con id no visible | bloqueo verificable con row existente | 204 (sin evidencia de row afectada) | BLOCKED | `COORD_REQUESTS_UPDATE_ANON` | tabla `coordinator_requests` | Requiere JWT y row controlada para confirmar bypass/no bypass | Alta | PATCH `/rest/v1/coordinator_requests?...` con JWT de prueba |
| T-040 | Escalada de rol por PATCH profile | bloqueo de cambio `role` verificable | 204 (sin evidencia de row afectada) | BLOCKED | `PROFILES_ROLE_PATCH_ANON` | tabla `profiles` / trigger C-01 | Requiere JWT de usuario real para prueba concluyente | Alta | PATCH `/rest/v1/profiles?...` con usuario autenticado |
| T-041 | mark_all_notifications_read (anon) | denegar o requerir auth efectiva | 200 con retorno `0` | FAIL | `RPC_MARK_ALL_NOTIFICATIONS_READ_ANON` | RPC `mark_all_notifications_read` | Superficie RPC accesible para anon | Media | POST `/rest/v1/rpc/mark_all_notifications_read` |
| T-042 | register_push_subscription (anon) | denegar auth | ejecuta y falla por `user_id null` | FAIL | `RPC_REGISTER_PUSH_SUBSCRIPTION_ANON` | RPC `register_push_subscription` | Superficie RPC accesible a anon | Media | POST `/rest/v1/rpc/register_push_subscription` |
| T-043 | Triggers críticos presentes | triggers de validación/auditoría/notificación activos | listado completo presente | PASS | SQL `information_schema.triggers` | tablas `needs/reports/centers/profiles` | Infra de triggers activa | Alta | query triggers por tablas críticas |
| T-044 | C-02 policies runtime | `insert_own` removida y `admin_insert` presente | cumple ambos checks | PASS | SQL checks consolidados | `coordinator_profiles` policies | Mitigación C-02 parcial confirmada | Alta | query checks consolidados |
| T-045 | C-05 grant EXECUTE anon en log_auth_event | debe ser false | true | FAIL | SQL `has_function_privilege` + routine_privileges | RPC `log_auth_event` | C-05 abierto | Crítica | `has_function_privilege('anon', 'public.log_auth_event(...)', 'EXECUTE')` |

---

## Incidencias

1. **C-03 abierto en runtime**: Edge `send-notification-push` desplegada sin validación de secreto y con `verify_jwt=false`.
2. **C-04 abierto en runtime**: RPC `notify_coordinator_request_user` ejecutable por anon (falla por FK, no por permisos).
3. **C-05 abierto en runtime**: RPC `log_auth_event` ejecutable por anon.
4. **A-05 abierto en runtime**: policy `public_read_persons` activa.
5. **A-08 abierto en runtime**: `profiles` y `coordinator_profiles` siguen en `supabase_realtime`.
6. **A-10 abierto en runtime**: no existe índice único de coordinador activo por sitio.
7. **A-11 abierto en runtime**: `validate_need_write` sin ownership check.
8. **A-12 abierto en runtime**: policies `regional_admin_insert_*` sin control explícito `status='active'`.
9. **Regresión funcional**: inserción anónima de reportes falla por FK en pipeline de notificaciones.
10. **Capacidad de QA local incompleta**: lint no ejecuta por ausencia de `eslint` en entorno.

---

## Bloqueantes (BLOCKED)

Pruebas bloqueadas por falta de insumos de ejecución:

1. **JWT usuario normal** para validar C-01/A-05/A-09 con rows reales.
2. **JWT coordinador** para validar A-11 y permisos de needs/personas por ownership.
3. **JWT regional_admin/super_admin** para aprobar/rechazar coordinadores y validar A-02/A-03/A-12 en E2E real.
4. **Datos controlados de prueba** (requests/site IDs dedicados QA) para concurrencia determinística.
5. **Dispositivo/push subscription real** para validar entrega push end-to-end (no solo invocación edge).
6. **Sesiones websocket de usuarios reales** para verificación live de no emisión en realtime A-08.
7. **Fuente oficial de historial de migraciones runtime** accesible para trazabilidad de versiones aplicadas.

---

## Hallazgos

- El runtime activo no refleja completamente los hardenings reportados en repositorio.
- Hay mitigaciones sí aplicadas (A-01, A-02, A-03, A-04, A-06 y partes de C-01/C-02/A-07/A-09), pero conviven con fallos críticos abiertos.
- El flujo público de reporte presenta fallo funcional reproducible (409 por FK en notificación).

---

## Recomendaciones

1. Resolver bloqueantes de credenciales QA (JWTs de roles y dataset controlado) para cerrar pruebas BLOCKED.
2. Sincronizar runtime con versión endurecida esperada (especialmente Edge y grants RPC críticos).
3. Re-ejecutar esta misma batería automática tras sincronización y exigir 0 FAIL críticos para habilitar release.

---

## Veredicto final

## **NO GO**

Justificación objetiva:
- FAIL en controles críticos C-03, C-04 y C-05 en runtime real.
- FAIL en múltiples controles altos (A-05, A-08, A-10, A-11, A-12).
- Regresión funcional reproducible en inserción de reportes.
