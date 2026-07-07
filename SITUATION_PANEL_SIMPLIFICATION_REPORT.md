# FARO - Reporte de simplificacion del panel operativo

Fecha: 2026-07-07

## 1) Logica simplificada

- El resumen ejecutivo ahora usa datos reales de `needs` y excluye automaticamente necesidades con cobertura `>= 100%`.
- Las necesidades cubiertas dejan de contarse como pendientes y salen del Top Prioridades.
- El panel principal ya no muestra recomendaciones automaticas ni textos largos de accion.
- Las tarjetas de prioridad muestran solo: recurso, centro, prioridad, cobertura actual, cantidad actual, cantidad objetivo y faltante.
- La seccion de cubiertas se reemplazo por contador compacto (`✓ N necesidades resueltas`) con boton `Ver historial`.

## 2) Consultas/operaciones optimizadas

- Priorizacion principal en memoria con un solo recorrido de necesidades filtradas por centros visibles.
- Separacion explicita de conjuntos:
  - `unresolved`: necesidades pendientes
  - `resolved`: necesidades cubiertas/resueltas
- Nuevo bloque de mantenimiento super_admin para limpiar datos sin entrar a Supabase:
  - archivar cubiertas
  - limpiar reportes descartados
  - eliminar datos de prueba
  - reiniciar dashboard (limpieza ligera)
  - limpiar eventos antiguos
  - eliminar necesidades cerradas
  - limpiar notificaciones antiguas

## 3) Componentes y archivos modificados

- `src/lib/situation-intelligence.ts`
  - Reescritura del algoritmo de resumen.
  - Nueva estructura: `pendingCount`, `resolvedCount`, `priorities`, `resolvedHistory`.
- `src/components/faro/situation-summary.tsx`
  - UI simplificada de tarjetas.
  - Eliminacion de recomendaciones automáticas.
  - Historial de resueltas bajo demanda.
- `src/screens/situation-screen.tsx`
  - `SituationSummary` ahora recibe `needs` para priorizacion real por cantidades.
- `src/components/pwa/PwaUpdateBanner.tsx`
  - Actualizaciones no criticas: se sugieren cuando el SW esta listo.
  - Actualizaciones criticas: siguen bloqueando hasta actualizar.
- `src/lib/admin-types.ts`
  - Nuevo modulo `maintenance` para super_admin.
- `src/repositories/admin-repository.ts`
  - Nueva operacion `runMaintenanceAction(...)` con acciones de limpieza.
- `src/services/admin-service.ts`
  - Exposicion de `runMaintenanceAction(...)`.
- `src/hooks/useAdminConsole.ts`
  - Nueva mutacion `runMaintenanceAction`.
- `src/components/admin/super-admin-console.tsx`
  - Nuevo modulo `Mantenimiento` con confirmacion por accion.

## 4) Nuevo algoritmo de priorizacion

Orden aplicado:

1. Cobertura mas baja (ascendente)
2. Prioridad (`critical`, `high`, `medium`, `low`)
3. Fecha (se usa `updatedAt` como referencia temporal del registro)

Reglas clave:

- Una necesidad cubierta (`>= 100%`) se considera resuelta y no aparece como critica.
- Necesidades con `required <= 0` se tratan como cerradas/resueltas para no contaminar prioridades.
- El Top Prioridades muestra solo pendientes reales.

## 5) Herramientas nuevas para super_admin

Modulo: `Mantenimiento` (solo consola super_admin)

- Archivar necesidades cubiertas
- Limpiar reportes descartados
- Eliminar datos de prueba
- Reiniciar dashboard
- Limpiar eventos antiguos
- Eliminar necesidades cerradas
- Limpiar notificaciones antiguas

Cada accion solicita confirmacion antes de ejecutarse y devuelve conteo de registros procesados.
