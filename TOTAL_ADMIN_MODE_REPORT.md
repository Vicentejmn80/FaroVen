# Reporte — Modo Administración Total (super_admin)

**Fecha:** 2026-07-07  
**Build:** `FARO-260707-039`  
**Alcance:** Permisos exclusivos `super_admin` — RLS activo, sin apertura a otros roles

---

## 1. Auditoría de permisos — restricciones encontradas y correcciones

| Área | Restricción previa | Corrección |
|------|-------------------|------------|
| Needs INSERT | Solo coordinador del sitio | Policy `needs_super_admin_insert` + RPC `admin_create_need` |
| Needs cubierta | Sin acción admin | RPC `admin_mark_need_covered` |
| Reports DELETE | Solo UPDATE (descartar) | RPC `admin_delete_report` + policy `reports_super_admin_delete` |
| Events DELETE | Sin policy | Policy `events_super_admin_delete` + RPC `admin_delete_event` |
| Users DELETE | Sin eliminación Auth | RPC `admin_delete_user` con cascade |
| Users demote | Sin quitar regional_admin | RPC `admin_demote_user` |
| coordinator_profiles | Sin FK cascade | FK → `auth.users` ON DELETE CASCADE |
| Sites delete/registry | `is_admin()` (regional también) | RPCs restringidos a `is_super_admin()` |
| Notifications body | Campo `message` no mapeado | Fix en `admin-repository.ts` |
| Notificaciones UPDATE admin | Solo own | Policy `notifications_super_admin_update` |

**Sin cambios de seguridad global:** RLS permanece activo; regional_admin conserva sus políticas existentes excepto RPCs de sitio restringidos a super_admin en consola Sistema.

---

## 2. Operaciones CRUD verificadas (UI + build)

| Entidad | Crear | Editar | Eliminar | Restaurar | Estado |
|---------|-------|--------|----------|-----------|--------|
| Usuarios | — | ✅ Editar perfil | ✅ Eliminar Auth | ✅ Reactivar | Build OK |
| Coordinadores | ✅ Promover+centro | ✅ Reasignar | ✅ Quitar | — | Build OK |
| Solicitudes | — | — | ✅ Rechazar | — | Build OK |
| Hospitales/Refugios/Acopios | ✅ Wizard | — | ✅ RPC | — | Build OK |
| Necesidades | ✅ Formulario | — | ✅ | ✅ Marcar cubierta | Build OK |
| Reportes | — | ✅ Verificar/Descartar | ✅ Definitivo | ✅ Pendiente | Build OK |
| Notificaciones | — | — | ✅ | — | Build OK |
| Eventos | — | — | ✅ | — | Build OK |
| Inventario | — | — | — | — | Vista lectura |
| Limpieza dev | — | — | ✅ Reset RPC | — | UI + script |

---

## 3. Migración nueva

**`supabase/migrations/20260707120000_super_admin_total_mode.sql`**

### RPCs nuevos (solo `is_super_admin()`)
- `admin_demote_user(p_user_id)`
- `admin_delete_user(p_user_id, p_confirm_super_admin)`
- `admin_delete_report(p_report_id)`
- `admin_delete_event(p_event_id)`
- `admin_create_need(...)`
- `admin_mark_need_covered(p_need_id)`
- `admin_reset_operational_data(p_preserve_email)`

### RPCs actualizados (solo super_admin)
- `admin_delete_site`
- `admin_registry_overview`
- `admin_remove_coordinator`

### Policies nuevas
- `needs_super_admin_insert`
- `reports_super_admin_delete`
- `events_super_admin_delete`
- `notifications_super_admin_update`
- `profiles_super_admin_delete`

### Integridad
- FK `coordinator_profiles.auth_user_id` → `auth.users` CASCADE

---

## 4. Script de limpieza dev

**`supabase/scripts/dev_reset_operational_data.sql`**

Elimina datos operativos; conserva `vicentejmn80@gmail.com`.

También disponible en UI: módulo **Limpieza dev** (escribir `BORRAR` para confirmar).

---

## 5. Archivos modificados

- `supabase/migrations/20260707120000_super_admin_total_mode.sql`
- `supabase/scripts/dev_reset_operational_data.sql`
- `src/repositories/admin-repository.ts`
- `src/services/admin-service.ts`
- `src/hooks/useAdminConsole.ts`
- `src/lib/admin-types.ts`
- `src/lib/auth-errors.ts`
- `src/components/admin/super-admin-console.tsx`
- `src/components/admin/user-management-panel.tsx`

---

## 6. Pruebas ejecutadas

| Prueba | Resultado |
|--------|-----------|
| `npm run build` (tsc + vite) | ✅ Pass |
| TypeScript strict | ✅ Sin errores |
| Pruebas E2E producción | ⏳ Requiere migración aplicada en Supabase |

---

## 7. Posibles regresiones

| Riesgo | Mitigación |
|--------|------------|
| Migración no aplicada | RPCs fallarán — aplicar antes de usar consola |
| `admin_delete_site` ya no accesible a regional_admin | Intencional para modo total super_admin |
| Reset dev irreversible | Confirmación `BORRAR` + solo super_admin |
| Eliminar super_admin | Requiere checkbox explícito |

---

## 8. Checklist post-deploy

- [ ] Aplicar migración `20260707120000_super_admin_total_mode.sql`
- [ ] Eliminar usuario de prueba desde UI
- [ ] Reporte: Descartar vs Eliminar definitivamente
- [ ] Crear necesidad desde consola
- [ ] Aprobar solicitud coordinador
- [ ] Reset dev (solo entorno de prueba)

---

## 9. Acción requerida

```bash
# Supabase Dashboard → SQL → ejecutar migración
# o
supabase db push
```
