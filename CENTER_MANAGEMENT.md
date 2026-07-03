# FARO — Center Management

Auditoría completa del flujo de permisos y gestión de centros.  
Fecha: 2 de julio de 2026.

---

## 1. Causa raíz encontrada

### Bug #1 — Frontend: botón inexistente para admins (CRÍTICO)

**Archivo:** `src/screens/situation-screen.tsx`

El componente `SituationScreen` recibía la prop `onRegisterSite` y la exponía como botón
**únicamente cuando no había ningún centro registrado** (`sites.length === 0`).
En cuanto se registraba el primer centro, el botón desaparecía permanentemente.
Ningún rol podía crear un segundo centro porque la UI nunca lo ofrecía.

```diff
// ANTES (lines 73–85): solo aparecía si sites.length === 0
{!isLoading && !loadError && sites.length === 0 && (
  <GlassCard>
    ...
    {onRegisterSite && <EmergencyButton onClick={onRegisterSite}>Registrar primer sitio</EmergencyButton>}
  </GlassCard>
)}

// DESPUÉS: botón siempre visible en el header cuando el admin está autenticado
<PageHeader onRegisterSite={onRegisterSite} />   // botón + en la esquina superior
```

### Bug #2 — Frontend: el botón "+" llevaba a Reports para admins (SECUNDARIO)

**Archivo:** `src/components/app/AppShell.tsx`

La función `openMenu()` verificaba solo `isCoordinatorOps` (que es verdadero únicamente para
coordinadores). Para admins (`REGIONAL_ADMIN`, `SUPER_ADMIN`), el "+" navegaba a la pestaña
Reports en lugar de abrir el wizard de creación de centros.

```diff
// ANTES
const openMenu = () => {
  if (!isCoordinatorOps) { closeFlow(); setTab('reports'); return }  // admins iban aquí
  openFlow('menu')
}

// DESPUÉS
const openMenu = () => {
  if (isCoordinatorOps) { openFlow('menu'); return }
  if (canAccessAdminPanel) { openFlow('register-site'); return }   // admins → wizard
  closeFlow(); setTab('reports')
}
```

### Bug #3 — Frontend: pantalla "Revisa tu correo" nunca se cerraba (EMAIL)

**Archivos:** `src/screens/auth-screen.tsx` + `src/components/app/AppShell.tsx`

Cuando el usuario confirmaba su email (mismo tab o tab diferente), Supabase publicaba la sesión
vía `localStorage` → `onAuthStateChange` disparaba en todos los tabs → `session` se actualizaba
en `AuthContext`. Sin embargo, el `flow === 'auth'` permanecía abierto en `AppShell` y el
`AuthScreen` en modo `check-email` no escuchaba el cambio de sesión.

**Solución implementada (dos capas):**

1. **`AppShell.tsx`**: nuevo `useEffect` que cierra el flow de auth cuando llega la sesión:
   ```typescript
   useEffect(() => {
     if (session && flow === 'auth') {
       startTransition(() => setFlow(null))
     }
   }, [session, flow])
   ```

2. **`auth-screen.tsx`**: guard en `AuthScreen` que llama `onClose` cuando el modo es
   `check-email` y la sesión llega:
   ```typescript
   useEffect(() => {
     if (mode === 'check-email' && session) {
       onClose?.()
     }
   }, [mode, session, onClose])
   ```

Esto cubre: mismo tab, otro tab del mismo navegador, y reabrir la app tras confirmar.

---

## 2. Permisos implementados

### Jerarquía final

| Acción                        | Super Admin | Administrador | Coordinador | Ciudadano |
|-------------------------------|:-----------:|:-------------:|:-----------:|:---------:|
| Ver centros en el mapa        | ✓           | ✓             | ✓           | ✓         |
| Crear hospital                | ✓           | ✓             | ✗           | ✗         |
| Crear refugio                 | ✓           | ✓             | ✗           | ✗         |
| Crear centro de acopio        | ✓           | ✓             | ✗           | ✗         |
| Editar cualquier centro       | ✓           | ✓             | solo el suyo | ✗       |
| Eliminar centros              | ✓           | ✓             | ✗           | ✗         |
| Asignar coordinadores         | ✓           | ✓             | ✗           | ✗         |
| Actualizar saturación         | ✓           | ✓             | ✓ (su centro) | ✗      |
| Registrar necesidades         | ✓           | ✓             | ✓           | ✗         |

### Frontend (guards)

- `canAccessAdminPanel = role === 'regional_admin' || role === 'super_admin'`
  → controla `onRegisterSite` prop y apertura del wizard
- `flow === 'register-site' && canAccessAdminPanel` → condición de render en AppShell

### Backend (RLS — Supabase)

Políticas activas en `hospitals`, `shelters`, `supply_centers`:

```sql
-- INSERT: solo admins (regional_admin + super_admin)
CREATE POLICY regional_admin_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());

-- UPDATE: admins O coordinador del propio centro
CREATE POLICY regional_admin_update_hospitals ON hospitals
  FOR UPDATE TO authenticated
  USING (is_elevated_admin() OR EXISTS (
    SELECT 1 FROM coordinator_profiles cp
    WHERE cp.auth_user_id = auth.uid()
      AND cp.site_type = 'hospital'
      AND cp.site_id = hospitals.id
  ))
  WITH CHECK (status = 'active');

-- DELETE: solo admins
CREATE POLICY admin_delete_hospitals ON hospitals
  FOR DELETE TO authenticated
  USING (is_admin());
```

Las funciones SQL de roles son:
- `is_super_admin()` → busca `role = 'super_admin'` en `profiles`
- `is_regional_admin()` → busca `role = 'regional_admin'` en `profiles`
- `is_elevated_admin()` → `is_super_admin() OR is_regional_admin()`
- `is_admin()` → `admin_emails OR is_elevated_admin()` (compatibilidad)

---

## 3. RLS modificadas / creadas

### Migration: `20260702280000_center_extended_fields.sql`

1. **Nuevas columnas** en las tres tablas:
   - `municipality TEXT` — municipio del centro
   - `state TEXT` — estado/región
   - `notes TEXT` (en shelters y supply_centers donde faltaba)

2. **RPC `admin_register_center`** — función SECURITY DEFINER que:
   - Verifica `is_elevated_admin()` antes de insertar
   - Aplica rate limit (50 inserts/hora por admin)
   - Valida todos los campos antes de insertar
   - Registra en `auth_audit_logs`
   - Disponible como alternativa segura al INSERT directo

3. **Políticas INSERT actualizadas** (sin `AND status = 'active'` en `WITH CHECK`, 
   que generaba confusión con valores por defecto):
   ```sql
   WITH CHECK (is_elevated_admin());  -- limpio y correcto
   ```

4. **Trigger `validate_center_write` actualizado** para incluir rate-limit en INSERT
   (antes solo en UPDATE):
   ```sql
   IF TG_OP = 'INSERT' THEN
     PERFORM enforce_rate_limit('center_insert', 50, 3600);
   ...
   ```

---

## 4. Funciones SQL creadas

### `admin_register_center(p_type, p_name, ...)`

```sql
CREATE OR REPLACE FUNCTION admin_register_center(
  p_type         TEXT,
  p_name         TEXT,
  p_address      TEXT    DEFAULT NULL,
  p_municipality TEXT    DEFAULT NULL,
  p_state        TEXT    DEFAULT NULL,
  p_latitude     DECIMAL DEFAULT NULL,
  p_longitude    DECIMAL DEFAULT NULL,
  p_contact_name TEXT    DEFAULT NULL,
  p_phone        TEXT    DEFAULT NULL,
  p_capacity     INTEGER DEFAULT 100,
  p_current_occ  INTEGER DEFAULT 0,
  p_schedule     TEXT    DEFAULT NULL,
  p_notes        TEXT    DEFAULT NULL
) RETURNS JSON
```

- **Seguridad:** SECURITY DEFINER + verificación `is_elevated_admin()`
- **Rate limit:** 50 registros/hora por actor (admin)
- **Audit log:** registra en `auth_audit_logs` con `action = 'admin_register_center'`
- **Retorna:** JSON row del centro creado

---

## 5. Flujo de creación de centros

### Antes (roto)
```
Admin → clic en mapa → NO hay botón
Admin → clic en "+" → va a pestaña Reports
```

### Ahora (correcto)
```
Admin → botón "+" en nav   → openFlow('register-site')
Admin → botón "Registrar"  → openFlow('register-site')  (header del mapa, siempre visible)
         ↓
     CreateCenterWizard
         ↓
  Paso 1: Tipo (hospital / refugio / acopio)
         ↓
  Paso 2: Ubicación (mapa + municipio + estado)
         ↓
  Paso 3: Información (nombre, responsable, tel, capacidad, horario, observaciones)
         ↓
  Paso 4: Confirmación (preview) → "Confirmar y publicar"
         ↓
  CenterRepository.create() → Supabase INSERT
         ↓
  Trigger trg_*_insert_event → inserta evento 'center_opened' en events
         ↓
  queryClient.invalidateQueries([centers, needs, events, summary])
         ↓
  Centro aparece en el mapa en tiempo real
```

---

## 6. Archivos modificados / creados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260702280000_center_extended_fields.sql` | **NUEVO** — columnas + RPC + policies |
| `src/types/supabase.ts` | Tipos de fila actualizados con campos nuevos |
| `src/repositories/types.ts` | `RegisterSiteInput` extendido |
| `src/repositories/center-repository.ts` | `create()` incluye campos nuevos |
| `src/repositories/mappers.ts` | mappers incluyen municipality, state, phone, schedule, observations |
| `src/domain/models.ts` | `Center` incluye campos opcionales nuevos |
| `src/components/admin/create-center-wizard.tsx` | **NUEVO** — wizard 4 pasos |
| `src/screens/situation-screen.tsx` | Botón "Registrar" siempre visible para admins |
| `src/components/app/AppShell.tsx` | Fix openMenu, fix email close, usa wizard |
| `src/screens/auth-screen.tsx` | Auto-cierre en check-email cuando llega sesión |

---

## 7. Integración automática

Al crear un centro, el sistema automáticamente:

1. **Mapa**: El centro aparece en `MapCanvas` al invalidar el query `centers`
2. **Timeline**: El trigger `trg_*_insert_event` inserta un evento `center_opened` → aparece en Activity Screen
3. **Reportes**: El nuevo centro queda disponible como destino para reportes ciudadanos
4. **Necesidades**: Coordinadores pueden agregar necesidades al nuevo centro
5. **Saturación**: El centro entra en el sistema de saturación y métricas
6. **Panel Coordinador**: Un coordinador puede ser asignado al nuevo centro desde el Admin Screen

---

## 8. Pruebas realizadas

### Build
```
✓ tsc --noEmit (0 errores)
✓ vite build (0 errores)
✓ 2196 módulos transformados
```

### Validación manual del flujo
- [ ] Super Admin: clic en "+" → se abre wizard
- [ ] Super Admin: clic en "Registrar" (botón header) → se abre wizard
- [ ] Paso 1: seleccionar tipo → avanzar
- [ ] Paso 2: seleccionar ubicación en mapa → avanzar (bloqueado sin pin)
- [ ] Paso 3: rellenar nombre + info → avanzar (bloqueado con nombre vacío)
- [ ] Paso 4: revisar datos → "Confirmar y publicar"
- [ ] Centro aparece en el mapa
- [ ] Evento aparece en el Timeline
- [ ] Administrador regional: mismo flujo
- [ ] Coordinador: NO ve el botón "+" de registrar
- [ ] Ciudadano: NO ve el botón "+" de registrar

### RLS (ejecutar en Supabase SQL Editor)
```sql
-- Verificar políticas INSERT vigentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('hospitals','shelters','supply_centers')
  AND cmd = 'INSERT';
-- Esperado: regional_admin_insert_* con WITH CHECK = is_elevated_admin()

-- Verificar función is_elevated_admin() como usuario con role regional_admin
SELECT is_elevated_admin();   -- debe retornar TRUE
SELECT is_elevated_admin();   -- como usuario sin rol → FALSE
```

### Email confirmation
- [ ] Crear cuenta nueva → aparece pantalla "Revisa tu correo"
- [ ] Hacer clic en el email → en el mismo tab: pantalla se cierra automáticamente
- [ ] Hacer clic en el email → en otro tab: al volver al tab original, la pantalla se cierra
- [ ] Dashboard accesible sin necesidad de acción manual

---

## 9. Checklist de validación para piloto

### Creación de centros
- [ ] Super Admin puede crear hospital, refugio y acopio
- [ ] Administrador regional puede crear hospital, refugio y acopio
- [ ] Coordinador NO puede crear centros (botón no aparece)
- [ ] Ciudadano NO puede crear centros (botón no aparece)
- [ ] El wizard valida campos obligatorios (no avanza sin pin en mapa, sin nombre)
- [ ] El centro creado aparece en el mapa inmediatamente
- [ ] El evento `center_opened` aparece en el Timeline
- [ ] Los campos municipality y state se guardan correctamente

### Seguridad backend
- [ ] INSERT directo sin `is_elevated_admin()` es rechazado por RLS
- [ ] RPC `admin_register_center` rechaza llamadas sin rol admin
- [ ] Rate limit de 50 inserts/hora funciona correctamente
- [ ] Audit log registra cada creación

### Email confirmation
- [ ] Pantalla check-email se cierra automáticamente al confirmar
- [ ] Funciona en mismo tab (PKCE flow)
- [ ] Funciona en tab diferente (cross-tab via localStorage)
- [ ] Funciona en navegador diferente (si Supabase envía token implícito)

### Estabilidad general
- [ ] No regresiones en flujo de coordinador
- [ ] No regresiones en flujo de ciudadano
- [ ] No regresiones en Admin Screen (gestión de solicitudes)
- [ ] Build en producción (Vercel) sin errores
