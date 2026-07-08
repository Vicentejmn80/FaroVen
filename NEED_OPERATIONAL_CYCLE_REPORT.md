# FARO — Reporte Ciclo Operativo de Necesidades

Fecha: 2026-07-07

## Cambios en base de datos

- Nueva migración: `supabase/migrations/20260707210000_need_operational_cycle.sql`
- Nuevos tipos:
  - `need_cycle_status` (`active`, `pending_closure`, `resolved`, `reopened`)
  - `need_cycle_outcome` (`resolved`, `reopened`, `no_resources`, `cancelled`)
- Nueva tabla: `operational_settings`
  - Guarda configuración global del ciclo (`need_cycle_duration_hours`).
- Nueva tabla: `need_cycles`
  - Historial por ciclo, con cantidades, duración y resultado.
- Nuevos triggers:
  - `trg_need_cycle_defaults` aplica duración y expiración automática al crear necesidades.
- Nuevos RPCs:
  - `refresh_need_cycles()` → marca necesidades vencidas como `pending_closure` y notifica.
  - `close_need_cycle(...)` → cierra o reabre el ciclo y escribe historial.
- Actualizada la función `notification_category_for_type` para incluir `need_cycle_expired`.

## Nuevos campos agregados

En `needs`:
- `created_at`
- `status`
- `cycle_duration_hours`
- `cycle_number`
- `cycle_started_at`
- `expires_at`
- `closed_at`
- `closure_reason`

En `need_cycles` (historial):
- `cycle_number`, `started_at`, `ended_at`, `duration_hours`
- `qty_required`, `qty_received`, `qty_missing`
- `outcome`, `closure_reason`

## Cambios en el modelo de necesidades

- `NeedStatus` ahora es: `active`, `pending_closure`, `resolved`, `reopened`.
- La UI pública ignora `pending_closure` y `resolved`.
- Los coordinadores sí ven `pending_closure` y deben cerrarlo obligatoriamente.

## Cambios en backend

- `need-repository` añade:
  - `refreshCycles()` → llama `refresh_need_cycles`
  - `closeCycle()` → llama `close_need_cycle`
- `repository-service` expone `refreshNeedCycles` y `closeNeedCycle`.
- `coordinator-service` y `faro-service` filtran necesidades por estado operativo.
- `mappers` ahora mapearán los nuevos campos y estatus desde Supabase.

## Cambios en frontend

- **Modal bloqueante** para cierre de ciclo:
  - `NeedCycleClosureModal`
  - Bloquea navegación hasta responder.
- **Badges**:
  - Contador en pestaña “Necesidades” del panel coordinador.
  - Mensaje visible en la lista de necesidades.
- **Onboarding**:
  - Nueva tarjeta: “Ciclo Operativo FARO”.
- **Panel público**:
  - No muestra necesidades `pending_closure`.
- **AppShell**:
  - Refresco automático de ciclos cada 5 min + al volver a primer plano.

## Componentes creados

- `src/components/coordinator/need-cycle-closure-modal.tsx`

## Flujo completo del Ciclo Operativo

1. Al crear una necesidad:
   - `cycle_duration_hours` se toma de `operational_settings` (default 24h).
   - `expires_at = created_at + duración`.
   - `status = active`.
2. Cuando `expires_at` vence:
   - `refresh_need_cycles()` marca `pending_closure`.
   - Se envía notificación `need_cycle_expired` al coordinador.
3. Al abrir FARO:
   - Modal obligatorio solicita resultado del ciclo.
4. Si registra cantidad recibida:
   - `qty_received` se incrementa.
   - Si falta, pregunta si desea continuar.
5. Si responde **Sí**:
   - No crea nueva necesidad.
   - `cycle_number++`, `status = reopened`, `qty_required = restante`, `qty_received = 0`.
6. Si responde **No**:
   - `status = resolved`, `closed_at` guardado.
   - Registro en `need_cycles`.
7. Si recibió 100%:
   - Se resuelve automáticamente.

## Posibles regresiones

- El cierre del ciclo usa `qty_received + recibido` (si un coordinador ya actualizó stock, debe ingresar solo lo recibido en este ciclo).
- El trigger `log_event_from_need` registrará eventos al cambiar estado, podría aumentar el timeline.
- `refresh_need_cycles()` requiere sesión autenticada y rol válido.

## Casos de prueba recomendados

1. Crear necesidad y verificar `expires_at` y `cycle_duration_hours`.
2. Simular vencimiento y confirmar que cambia a `pending_closure`.
3. Ver notificación `need_cycle_expired` y badge en panel coordinador.
4. Registrar resultado parcial → continuar ciclo.
5. Registrar resultado parcial → cerrar definitivamente.
6. Registrar resultado total → resolver automáticamente.
7. Usar “No llegó ninguna” → reabrir o cerrar.
8. Cambiar duración en Super Admin → nuevas necesidades usan el nuevo valor.
9. Verificar que necesidades `pending_closure` no aparecen en el panel público.
