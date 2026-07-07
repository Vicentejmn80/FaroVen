# Reporte de validación — Super Admin Console FARO

**Fecha:** 2026-07-07  
**Build:** `FARO-260707-038` · commit base `470f88c`  
**Estado:** Implementación completa en frontend + migración SQL lista para aplicar

---

## 1. Archivos modificados

### Base de datos
| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/20260707090000_super_admin_console_profiles_roles.sql` | Perfiles extendidos, RPCs de roles, políticas admin |

### Backend / servicios (frontend)
| Archivo | Descripción |
|---------|-------------|
| `src/lib/admin-types.ts` | Tipos de consola admin |
| `src/lib/roles.ts` | `canAccessSystemPanel(email)`, `resolveDisplayRoleLabel`, bootstrap email |
| `src/repositories/admin-repository.ts` | Acceso RPC y queries admin |
| `src/repositories/auth-types.ts` | Campos phone, organization_name, profession, specialty, municipality, region |
| `src/repositories/auth-repository.ts` | Mapeo y upsert con teléfono |
| `src/services/admin-service.ts` | Orquestación CRUD admin |
| `src/services/auth-service.ts` | Registro con teléfono obligatorio |
| `src/hooks/useAdminConsole.ts` | React Query hooks admin |

### UI
| Archivo | Descripción |
|---------|-------------|
| `src/components/admin/super-admin-console.tsx` | Consola modular Super Admin (10 módulos) |
| `src/components/admin/user-management-panel.tsx` | Gestión roles, centro obligatorio, suspender/revocar |
| `src/screens/system-admin-screen.tsx` | Integración consola |
| `src/screens/profile-screen.tsx` | Perfil por rol (Super Admin / Coordinador) |
| `src/screens/auth-screen.tsx` | Teléfono obligatorio en registro |
| `src/store/auth-context.tsx` | signUp con phone, acceso sistema por email+rol |
| `src/components/app/AppShell.tsx` | Navegación con email bootstrap |
| `src/components/faro/app-navigation.tsx` | Tab Sistema con email bootstrap |

### PWA Android
| Archivo | Descripción |
|---------|-------------|
| `scripts/gen-icons.mjs` | Maskable full-bleed + monochrome |
| `public/manifest.webmanifest` | PNG 192/512, maskable, monochrome (sin SVG) |
| `public/icons/icon-monochrome-*.png` | Nuevos assets |
| `vite.config.ts` | Manifest PWA alineado |
| `index.html` | theme-color `#003399` |
| `package.json` | `gen-icons` en prebuild |

---

## 2. Migraciones nuevas

**`20260707090000_super_admin_console_profiles_roles.sql`**

### Cambios en DB
- **profiles:** `phone`, `organization_name`, `profession`, `specialty`, `municipality`
- **Bootstrap:** `vicentejmn80@gmail.com` → `super_admin` activo
- **handle_new_user:** persiste teléfono desde metadata
- **RPCs nuevos:**
  - `revoke_coordinator_role(user_id)`
  - `admin_update_user_status(user_id, status)`
  - `admin_update_profile(...)`
  - `admin_list_coordinators()`
  - `admin_list_notifications(limit)`
- **RPCs actualizados:**
  - `promote_user_role` — bloquea `coordinator` (exige `assign_coordinator_role`)
  - `assign_coordinator_role` — valida sitio único
  - `admin_remove_coordinator` — también limpia rol en profiles
- **Políticas:** super_admin read/delete notifications, super_admin update needs

### ⚠️ Acción requerida
Aplicar la migración en Supabase (Dashboard SQL o CLI):
```bash
supabase db push
```
Sin esto, los RPCs nuevos y columnas de perfil **no existirán** en producción.

---

## 3. Cambios de frontend

### Consola Super Admin (tab Sistema)
Módulos disponibles:
1. **Usuarios** — promover admin/coordinador, suspender, revocar rol
2. **Coordinadores** — listado con centro, quitar asignación
3. **Hospitales / Refugios / Acopios** — listar, crear (wizard), eliminar
4. **Necesidades** — listar, eliminar
5. **Reportes** — verificar, descartar, restaurar
6. **Notificaciones** — bandeja global, eliminar
7. **Inventario** — vista de cobertura/stock
8. **Auditoría** — timeline auth + operacional

### Lógica de roles
- Coordinador **solo** vía `assign_coordinator_role` con `site_id` obligatorio
- UI bloquea confirmar sin centro seleccionado
- Al revocar coordinador: elimina `coordinator_profiles` + limpia rol
- Tarjetas muestran centro asignado en tiempo real (React Query invalidation)
- Perfil: nunca muestra "Coordinador" sin centro; muestra "Pendiente de centro"

### Registro
- Campo **Teléfono** obligatorio en signup
- Metadata: `{ full_name, phone }` → trigger DB → `profiles.phone`
- Campos futuros en schema (nullable, compatibles con usuarios existentes)

### PWA Android
- Iconos PNG 192/512 (`purpose: any`)
- Maskable full-bleed (mismo azul que iOS, sin halo oscuro)
- Monochrome 192/512 para Android 13+ themed icons
- `manifest.webmanifest` sincronizado con `vite.config.ts`
- Sin SVG como icono principal

---

## 4. Pruebas realizadas

| Prueba | Resultado |
|--------|-----------|
| `npm run build` (tsc + vite) | ✅ Pass |
| `node scripts/gen-icons.mjs` | ✅ 11 PNG generados |
| TypeScript strict | ✅ Sin errores |
| Lint (archivos tocados) | No ejecutado en CI |

### Pruebas pendientes (requieren migración + deploy)
- [ ] Login como `vicentejmn80@gmail.com` → tab Sistema visible
- [ ] Promover coordinador sin centro → bloqueado en UI
- [ ] Promover coordinador con centro → profiles + coordinator_profiles OK
- [ ] Revocar coordinador → rol NULL, perfil eliminado
- [ ] Suspender/reactivar usuario
- [ ] Eliminar sitio vía RPC
- [ ] Registro nuevo usuario con teléfono
- [ ] Instalar PWA en Android (Chrome / Samsung Internet) y verificar icono azul

---

## 5. Posibles regresiones

| Riesgo | Mitigación |
|--------|------------|
| Migración no aplicada | RPCs fallarán con error Postgres; aplicar antes de deploy |
| Usuarios existentes sin teléfono | Columna nullable; solo nuevos registros exigen teléfono |
| `theme_color` cambió a `#003399` | Status bar/splash más azules; coherente con icono |
| Admin regional pierde acceso Sistema | Intencional: consola solo Super Admin |
| Coordinadores huérfanos pre-migración | Mostrar "Pendiente de centro"; reasignar desde consola |
| `admin_list_notifications` volumen alto | Limit 150 por defecto, max 500 en RPC |

---

## 6. Riesgos detectados

1. **Migración pendiente en remoto** — bloqueante para funciones admin en producción
2. **Edición inline de necesidades/reportes** — delete/review implementado; create/edit avanzado usa flujos existentes (wizard centros)
3. **Email bootstrap vs rol DB** — UI permite acceso por email, pero RPCs exigen `profiles.role = super_admin`; migración asegura consistencia
4. **Usuarios legacy sin phone** — no afecta login; pueden completar teléfono cuando editemos perfil propio (futuro)

---

## 7. Checklist de validación

### Super Admin
- [ ] Tab **Sistema** visible para Vicente / super_admin
- [ ] Módulo Usuarios: promover admin regional
- [ ] Módulo Usuarios: promover coordinador **solo** con centro
- [ ] Módulo Usuarios: suspender y reactivar
- [ ] Módulo Usuarios: revocar coordinador
- [ ] Módulo Coordinadores: listado con centro
- [ ] Módulos Hospitales/Refugios/Acopios: crear y eliminar
- [ ] Módulo Necesidades: eliminar ítem
- [ ] Módulo Reportes: verificar / descartar / restaurar
- [ ] Módulo Notificaciones: listar y eliminar
- [ ] Módulo Inventario: métricas de cobertura
- [ ] Módulo Auditoría: eventos visibles

### Roles y perfil
- [ ] Coordinador sin centro → perfil muestra aviso, no badge coordinador
- [ ] Coordinador con centro → centro visible en perfil
- [ ] Super Admin → alcance global en perfil
- [ ] Cambio de rol reflejado sin recargar (realtime profiles)

### Registro
- [ ] Signup sin teléfono → error
- [ ] Signup con teléfono → guardado en profiles

### PWA Android
- [ ] Icono azul en launcher (no cyan SVG)
- [ ] Maskable sin halo oscuro
- [ ] Themed icon (monochrome) en Android 13+
- [ ] Chrome, Samsung Internet, Pixel Launcher

---

## 8. Próximos pasos recomendados

1. Aplicar migración `20260707090000_super_admin_console_profiles_roles.sql` en Supabase
2. Commit + push a `main` para deploy Vercel
3. Validar checklist en producción con cuenta Super Admin
4. (Opcional) Formulario editar perfil propio con teléfono para usuarios legacy
