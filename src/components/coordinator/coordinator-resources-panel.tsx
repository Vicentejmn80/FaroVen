import { useMemo, useState } from 'react'
import { Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SectionHeader } from '@/components/coordinator/section-header'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useAuth } from '@/store/auth-context'
import {
  useCenterResources,
  useRemoveCatalogInventory,
  useSetCatalogInventory,
} from '@/hooks/useCenterOperations'
import {
  getResourceLabel,
  getResourceMinRecommended,
  getResourceUnit,
  groupSelectableByCategory,
  RESOURCE_CATEGORY_LABELS,
  type ResourceCategory,
} from '@/lib/resource-catalog'
import { cn, timeAgo } from '@/lib/utils'
import type { CenterResource } from '@/domain/center-operations.types'
import type { RegisterSiteType } from '@/repositories/types'

function stockTone(current: number, min: number): 'ok' | 'low' | 'critical' {
  if (current <= 0) return 'critical'
  if (current < min) return 'low'
  return 'ok'
}

const TONE_TEXT = {
  ok: 'text-operational',
  low: 'text-warning',
  critical: 'text-critical',
} as const

/**
 * Inventario del Nodo Logístico — tarjetas simples desde catálogo central.
 * Reutiliza GlassCard / EmergencyButton. Sin nombres libres.
 */
export function CoordinatorInventoryPanel() {
  const { assignment } = useCoordinatorAssignment()
  const { user, profile } = useAuth()
  const centerId = assignment?.siteId ?? ''
  const siteType = (assignment?.siteType ?? 'hospital') as RegisterSiteType
  const { data: resources = [], isLoading } = useCenterResources(centerId)
  const setItem = useSetCatalogInventory()
  const removeItem = useRemoveCatalogInventory()

  const [showAdd, setShowAdd] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [qtyDraft, setQtyDraft] = useState(0)
  const [addKey, setAddKey] = useState('')
  const [addQty, setAddQty] = useState(10)
  const [addCategory, setAddCategory] = useState<ResourceCategory | 'all'>('all')

  const existingKeys = useMemo(
    () => new Set(resources.map((r) => r.resourceType)),
    [resources],
  )

  const catalogGroups = useMemo(() => {
    const groups = groupSelectableByCategory()
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => !existingKeys.has(item.key)),
      }))
      .filter((g) => g.items.length > 0)
  }, [existingKeys])

  const filteredGroups = useMemo(() => {
    if (addCategory === 'all') return catalogGroups
    return catalogGroups.filter((g) => g.category === addCategory)
  }, [catalogGroups, addCategory])

  if (!assignment) {
    return (
      <GlassCard className="p-4 text-center text-sm text-ink-muted">
        No tienes un centro asignado
      </GlassCard>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const actorId = user?.id
  const actorName = profile?.full_name ?? undefined

  const openEdit = (r: CenterResource) => {
    setEditingKey(r.resourceType)
    setQtyDraft(r.currentLevel)
    setShowAdd(false)
  }

  const saveEdit = () => {
    if (!editingKey) return
    setItem.mutate(
      {
        centerId,
        siteType,
        resourceType: editingKey,
        quantity: qtyDraft,
        actorId,
        actorName,
        reason: 'adjustment',
        sourceLabel: 'Ajuste de cantidad',
      },
      { onSuccess: () => setEditingKey(null) },
    )
  }

  const addResource = () => {
    if (!addKey) return
    setItem.mutate(
      {
        centerId,
        siteType,
        resourceType: addKey,
        quantity: addQty,
        actorId,
        actorName,
        reason: 'intake',
        sourceLabel: 'Alta de inventario',
      },
      {
        onSuccess: () => {
          setShowAdd(false)
          setAddKey('')
          setAddQty(10)
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Inventario"
        subtitle="Selecciona del catálogo. Sin nombres libres."
        icon={Package}
        action={
          <EmergencyButton
            variant="primary"
            size="sm"
            onClick={() => {
              setShowAdd((v) => !v)
              setEditingKey(null)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar
          </EmergencyButton>
        }
      />

      {showAdd && (
        <GlassCard className="space-y-3 p-4">
          <p className="text-xs font-medium text-ink">Nuevo recurso del catálogo</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setAddCategory('all')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                addCategory === 'all'
                  ? 'border-info/40 bg-info/15 text-ink'
                  : 'border-white/10 text-ink-subtle',
              )}
            >
              Todas
            </button>
            {(Object.keys(RESOURCE_CATEGORY_LABELS) as ResourceCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setAddCategory(cat)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                  addCategory === cat
                    ? 'border-info/40 bg-info/15 text-ink'
                    : 'border-white/10 text-ink-subtle',
                )}
              >
                {RESOURCE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-ink"
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
          >
            <option value="">Seleccionar recurso…</option>
            {filteredGroups.map((g) => (
              <optgroup key={g.category} label={g.label}>
                {g.items.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div>
            <label className="mb-1 block text-[11px] text-ink-subtle">Cantidad</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-ink"
              value={addQty}
              onChange={(e) => setAddQty(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="flex gap-2">
            <EmergencyButton
              variant="primary"
              size="sm"
              disabled={!addKey || setItem.isPending}
              onClick={addResource}
            >
              {setItem.isPending ? 'Guardando…' : 'Confirmar'}
            </EmergencyButton>
            <EmergencyButton variant="glass" size="sm" onClick={() => setShowAdd(false)}>
              Cancelar
            </EmergencyButton>
          </div>
        </GlassCard>
      )}

      {resources.length === 0 && !showAdd ? (
        <GlassCard className="p-5 text-center">
          <p className="text-sm text-ink-subtle">Sin recursos registrados</p>
          <p className="mt-1 text-xs text-ink-faint">Agrega el primero desde el catálogo</p>
        </GlassCard>
      ) : (
        resources.map((r) => {
          const min = r.minLevel || getResourceMinRecommended(r.resourceType)
          const tone = stockTone(r.currentLevel, min)
          const isEditing = editingKey === r.resourceType
          return (
            <GlassCard key={r.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{getResourceLabel(r.resourceType)}</p>
                  <p className={cn('text-xs font-medium tabular-nums', TONE_TEXT[tone])}>
                    {r.currentLevel} {r.unit || getResourceUnit(r.resourceType)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    Actualizado {timeAgo(r.updatedAt)}
                    {r.category ? ` · ${RESOURCE_CATEGORY_LABELS[r.category as ResourceCategory] ?? r.category}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <EmergencyButton variant="glass" size="sm" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </EmergencyButton>
                  <EmergencyButton
                    variant="glass"
                    size="sm"
                    className="text-critical"
                    disabled={removeItem.isPending}
                    onClick={() => {
                      if (!confirm(`¿Eliminar ${getResourceLabel(r.resourceType)} del inventario?`)) return
                      removeItem.mutate({
                        centerId,
                        resourceType: r.resourceType,
                        actorId,
                        actorName,
                      })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </EmergencyButton>
                </div>
              </div>

              {tone !== 'ok' && (
                <p className="text-[11px] text-warning">
                  Mínimo recomendado: {min} · Disponible: {r.currentLevel}
                </p>
              )}

              {isEditing && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <label className="block text-[11px] text-ink-subtle">Cantidad disponible</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink"
                    value={qtyDraft}
                    onChange={(e) => setQtyDraft(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <div className="flex gap-2">
                    <EmergencyButton
                      variant="primary"
                      size="sm"
                      disabled={setItem.isPending}
                      onClick={saveEdit}
                    >
                      Guardar
                    </EmergencyButton>
                    <EmergencyButton variant="glass" size="sm" onClick={() => setEditingKey(null)}>
                      Cancelar
                    </EmergencyButton>
                  </div>
                </div>
              )}
            </GlassCard>
          )
        })
      )}
    </div>
  )
}

/** @deprecated Usar CoordinatorInventoryPanel */
export function CoordinatorResourcesPanel() {
  return <CoordinatorInventoryPanel />
}
