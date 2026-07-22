# PRODUCTION_CERTIFICATION_PLAN

## Resumen ejecutivo

Objetivo: certificar FARO para producción validando funcionalidad crítica, seguridad en runtime y ausencia de regresiones tras hardening.  
Alcance: módulos funcionales principales, 17 controles de seguridad (C-01..C-05, A-01..A-12), infraestructura Supabase (RLS, RPC, triggers, storage, realtime, edge functions).  
Estrategia: ejecutar E2E por módulos + exploits de seguridad + verificación de despliegue repo vs runtime.

---

## Inventario funcional (módulos críticos)

| Módulo | Archivos clave (app) | Repos/servicios | RPC / Edge | Tablas / Triggers / Dependencias |
|---|---|---|---|---|
| Auth (login/registro/logout) | `src/screens/auth-screen.tsx`, `src/store/auth-context.tsx` | `src/services/auth-service.ts`, `src/repositories/auth-repository.ts` | `log_auth_event`, `promote_user_role`, `assign_coordinator_role` | `profiles`, `auth_audit_logs`; trigger `on_auth_user_created`; dep: Turnstile |
| Recuperación de contraseña | `src/screens/auth-screen.tsx` | `auth-service.updatePassword/resetPassword` | Supabase Auth API | `auth.users` + sesión |
| Onboarding coordinador | `src/screens/coordinator-request-screen.tsx`, `src/store/coordinator-context.tsx` | `auth-service`, `coordinatorRequestRepository` | `request_coordinator_info`, `respond_coordinator_info` | `coordinator_requests`, `coordinator_profiles`, `user_notifications`; trigger validate coordinator request |
| Aprobación/rechazo coordinador (admin) | `src/screens/admin-screen.tsx`, `src/components/admin/*` | `auth-service.approve/reject` | `approve_coordinator_request`, `reject_coordinator_request` | `coordinator_requests`, `profiles`, `coordinator_profiles`; notificaciones y audit log |
| Centros (hospital/shelter/supply) | `src/components/admin/create-center-wizard.tsx`, `src/screens/situation-screen.tsx` | `center-repository`, `repository-service` | `admin_register_center` | `hospitals`, `shelters`, `supply_centers`; trigger validate center write |
| Inventario / Needs | `src/components/coordinator/coordinator-needs-module.tsx`, `src/screens/actions-screen.tsx` | `need-repository`, `coordinator-service` | N/A directo (tabla) | `needs`; trigger `validate_need_write`; triggers de eventos/notificaciones |
| Personas | `src/screens/center-detail-screen.tsx` (flujo operativo), `src/hooks/useCenterTrust.ts` | queries a `persons` y mapeos | `search_person` | `persons`; trigger `persons_set_full_name_ts`; storage `person-lists` |
| Reportes ciudadanos | `src/screens/reports-screen.tsx` | `report-repository` | N/A directo (tabla) | `reports`; trigger `validate_report_write`; trigger `notify_on_citizen_report`; evento derivado |
| Eventos / Timeline | `src/repositories/event-repository.ts`, `src/services/faro-service.ts` | `event-repository` | N/A directo lectura | `events`; triggers `log_event_from_report/need/center` |
| Notificaciones in-app | `src/hooks/useNotifications.ts`, `src/components/notifications/UserNotificationSheet.tsx` | `supabase-notification-provider`, `user-notification-service` | `mark_notification_read`, `mark_all_notifications_read`, `delete_notification`, `upsert_notification_preferences` | `notifications`, `notification_preferences`, `admin_notifications`; triggers notify_* |
| Push notifications | `src/push-provider/onesignal-push-provider.ts`, `src/hooks/usePushNotifications.ts` | `push-service`, `notification-service` | `register_push_subscription`; Edge `send-notification-push` | `push_subscriptions`; secret `PUSH_WEBHOOK_SECRET`; OneSignal env |
| Storage (imágenes) | componentes de reportes/personas | N/A | Storage API | buckets `reports-images`, `person-lists`; policies en `storage.objects` |
| Realtime sync | `src/supabase/use-realtime-sync.ts`, `src/store/auth-context.tsx` | hooks invalidation | Supabase Realtime channels | publicación `supabase_realtime`; tablas públicas configuradas |
| Admin / User management | `src/screens/system-admin-screen.tsx`, `src/components/admin/user-management-panel.tsx` | `auth-repository.profileRepository`, `audit-repository` | `promote_user_role`, `assign_coordinator_role` | `profiles`, `auth_audit_logs`, `operational_audit_logs` |
| Auditoría operacional | UI admin + timeline | `audit-repository`, `audit-label-service` | `log_auth_event` (interno) | `auth_audit_logs`, `operational_audit_logs`; triggers audit_* |

Edge Functions detectadas:
- `supabase/functions/send-notification-push/index.ts`

---

## Matriz E2E (diseño)

Formato por módulo: Happy / Negativo / Límite / Permisos / Concurrencia / Seguridad.

| Módulo | Casos E2E obligatorios |
|---|---|
| Auth | H: login válido, signup válido, logout. N: credenciales inválidas, email no confirmado. L: múltiples intentos seguidos. P: usuario sin perfil activo. C: login en dos tabs. S: captcha ausente en producción debe bloquear si configurado fail-closed. |
| Recuperación | H: solicitar reset + actualizar password. N: token inválido. L: token expirado. P: email no existente (respuesta no enumerativa). C: doble submit reset. S: sesión previa invalidada tras cambio password. |
| Solicitud coordinador | H: submit pendiente. N: campos inválidos/sitio inválido. L: 5 solicitudes/día rate-limit. P: usuario no autenticado. C: doble submit simultáneo. S: no poder setear status directamente. |
| Aprobación/rechazo | H: approve crea/actualiza coordinator_profile + notifica; reject notifica. N: request no pending. L: request ya revisada. P: solo admins. C: dos admins aprobando mismo request. S: A-02/A-03/A-09 cubiertos (site válido, no downgrade admin, sin update directo). |
| Centros | H: crear hospital/shelter/supply por admin. N: coordenadas inválidas. L: texto largo. P: no-admin bloqueado. C: dos creaciones simultáneas mismo nombre. S: status forzado active en insert admin policies. |
| Needs | H: coordinador del sitio crea/actualiza need. N: qty negativa. L: qty alta límite. P: no coordinador bloqueado. C: updates concurrentes qty_received. S: trigger ownership A-11 + RLS. |
| Personas | H: coordinador lee/actualiza personas del sitio. N: anon sin acceso. L: búsqueda vacía/rápida. P: coordinador de otro sitio bloqueado. C: update simultáneo persona. S: A-05 no exposición pública. |
| Reportes | H: ciudadano crea reporte pending; admin/coordinador revisa según rol. N: site inválido. L: límite report_submit. P: anon no puede revisar. C: revisión simultánea de mismo reporte. S: trigger validate_report_write + notify_on_citizen_report. |
| Eventos | H: eventos aparecen por triggers al crear report/need/update center. N: inserción manual denegada. L: alta frecuencia de eventos. P: lectura pública según política vigente. C: múltiples updates generan secuencia ordenada. S: A-04 bloqueo insert directo. |
| Notificaciones | H: listar propias, marcar leídas, borrar, preferencias. N: notification_id ajeno. L: bulk mark all. P: solo own-row. C: doble mark-read. S: RPC own-scope + no inserts directos. |
| Push | H: registro subscription, envío legítimo por webhook, push_sent update. N: edge sin secret debe denegar. L: retries provider. P: usuario sin push_enabled no envía. C: dos webhooks mismo notification_id. S: C-03/C-04/C-05 explotación negativa. |
| Storage | H: upload owner folder, read own object. N: acceso público URL directa debe fallar en privados. L: tamaño máximo y mime inválido. P: owner-only update/delete. C: overwrite simultáneo. S: A-07 buckets privados + policies. |
| Realtime | H: invalidación de queries y sync de datos críticos. N: canal desconectado recupera. L: burst de cambios. P: tablas removidas de publicación no emiten. C: multi-tab subscriptions. S: A-08 (si perfiles fuera de realtime, no fugas). |
| Admin/Auditoría | H: panel carga perfiles/audit logs con rol admin. N: no-admin bloqueado. L: paginación logs. P: regional vs super admin permisos. C: múltiples acciones administrativas. S: A-01 + C-05 (no forge logs por cliente). |

---

## Análisis de regresión por hardening (evidencia de código)

### Cambios con riesgo funcional identificado
1. **A-08 realtime profiles/coordinator_profiles**  
   - `src/store/auth-context.tsx` depende de `postgres_changes` en `profiles` y `coordinator_profiles` para sincronizar rol en vivo.  
   - Si se removió publicación, puede requerir refresh/polling para reflejar aprobación.

2. **A-07 buckets privados**  
   - Cualquier URL pública histórica de `reports-images`/`person-lists` deja de funcionar.

3. **A-11 ownership en `validate_need_write`**  
   - `src/repositories/need-repository.ts` y `legacy-frontend/src/hooks/useQuickUpdate.ts` hacen insert/update directos; usuarios sin ownership serán bloqueados (esperado, pero requiere prueba funcional).

4. **A-10 unique coordinador activo por sitio**  
   - Si existen duplicados activos en runtime, migración fallará o flujos de aprobación pueden romper hasta limpieza de datos.

5. **C-03/C-04/C-05 runtime divergence**  
   - Evidencia previa de endpoint/rpc ejecutables donde debían denegar -> requiere validación de despliegue antes de E2E.

### Cambios con bajo riesgo funcional
- A-04 bloqueo insert manual en `events`: no se encontró `from('events').insert(...)` en `src`.
- A-09 bloqueo update directo `coordinator_requests`: frontend usa RPC approve/reject.
- A-01 is_admin por role only: frontend consulta `profiles.role`, no `admin_emails`.

---

## Checklist completo de certificación

### Infra / runtime parity (gate previo)
- [ ] Confirmar migraciones aplicadas en Supabase remoto (lista `2026070500*.sql`).
- [ ] Confirmar versión desplegada de `send-notification-push` y secret `PUSH_WEBHOOK_SECRET`.
- [ ] Confirmar grants efectivos de RPC críticas (`notify_coordinator_request_user`, `log_auth_event`).
- [ ] Confirmar estado de publicaciones Realtime y storage buckets/policies.

### Seguridad (17 controles)
- [ ] Ejecutar exploits C-01..C-05.
- [ ] Ejecutar exploits A-01..A-12.
- [ ] Registrar esperado vs obtenido + evidencia (status/body/sql output).

### Funcionalidad crítica
- [ ] Auth end-to-end (login/signup/reset/logout).
- [ ] Ciclo coordinador (solicitud/info/approve/reject).
- [ ] Operación centros + needs + reportes + personas.
- [ ] Eventos y notificaciones end-to-end.
- [ ] Push flow real (registro + dispatch + recepción).
- [ ] Storage upload/read con owner policies.
- [ ] Realtime sincronización observable.

### Observabilidad / SRE
- [ ] Logs de edge function con request-id correlacionable.
- [ ] Alertas mínimas para errores 5xx en functions.
- [ ] Métricas de rate-limit exceeded y colas de notificación.

---

## Orden recomendado de ejecución

1. **Gate 0:** Runtime parity (infra/security controls activos).  
2. **Gate 1:** Seguridad (17 exploits).  
3. **Gate 2:** E2E funcional crítico por módulos.  
4. **Gate 3:** Concurrencia y degradación controlada (realtime/push/storage).  
5. **Gate 4:** Sign-off GO/NO GO.

---

## Criterios GO / NO GO

### GO
- 17/17 controles de seguridad cerrados en runtime (sin bypass).
- 0 fallas críticas/altas en flujos funcionales críticos.
- Sin discrepancias repo vs runtime en grants/functions/edge config.
- Realtime y push con comportamiento esperado para operación.

### GO WITH CONDITIONS
- Sin vulnerabilidades críticas abiertas.
- Solo incidencias funcionales menores con workaround operativo documentado.
- Plan de remediación y fecha comprometida antes de lanzamiento masivo.

### NO GO
- Cualquier vulnerabilidad crítica abierta en runtime.
- RPC crítica ejecutable con permisos no esperados.
- Edge function sensible sin autenticación/secret efectivo.
- Flujos de emergencia (coordinación, reportes, needs, notificaciones) rotos.

---

## Riesgos residuales (a validar)

- Divergencia entre repositorio y despliegue real (migraciones no aplicadas o funciones no desplegadas).
- Dependencia de configuración remota (secrets, grants, publication) fuera de control del repo.
- Posibles efectos de hardening en legacy frontend (`legacy-frontend/*`).

---

## Evidencias requeridas para certificar

- Capturas/salidas de:
  - queries de verificación de grants/policies/triggers/publication,
  - resultados de cada exploit (status/body),
  - resultados E2E por módulo.
- Registro final de pass/fail por caso.
- Confirmación de versión desplegada de Edge Function y variables críticas.
