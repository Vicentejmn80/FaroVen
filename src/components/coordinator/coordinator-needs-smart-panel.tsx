import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { SectionHeader } from '@/components/coordinator/section-header'
import { CoordinatorNeedsModule } from '@/components/coordinator/coordinator-needs-module'
import { useCenterResources } from '@/hooks/useCenterOperations'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { useCoordinatorNeeds } from '@/hooks/useCoordinatorPanel'
import {
  catalogKeyToNeedCategory,
  getResourceLabel,
  getResourceMinRecommended,
} from '@/lib/resource-catalog'

interface CoordinatorNeedsSmartPanelProps {
  onCreateNeed?: (preset?: {
    categoryKey?: string
    itemName?: string
    quantity?: number
  }) => void
}

/**
 * Necesidades + sugerencias automáticas cuando el inventario está bajo el mínimo.
 */
export function CoordinatorNeedsSmartPanel({ onCreateNeed }: CoordinatorNeedsSmartPanelProps) {
  const { assignment } = useCoordinatorAssignment()
  const { data: resources = [] } = useCenterResources(assignment?.siteId ?? '')
  const needs = useCoordinatorNeeds()

  const suggestions = useMemo(() => {
    const activeNeedNames = new Set(
      needs
        .filter((n) => n.status !== 'resolved' && n.status !== 'pending_closure')
        .map((n) => n.type.toLowerCase()),
    )
    return resources
      .filter((r) => {
        const min = r.minLevel || getResourceMinRecommended(r.resourceType)
        return r.currentLevel < min
      })
      .filter((r) => !activeNeedNames.has(getResourceLabel(r.resourceType).toLowerCase()))
      .map((r) => {
        const min = r.minLevel || getResourceMinRecommended(r.resourceType)
        const deficit = Math.max(1, min - r.currentLevel)
        return {
          resourceType: r.resourceType,
          label: getResourceLabel(r.resourceType),
          available: r.currentLevel,
          min,
          deficit,
          categoryKey: catalogKeyToNeedCategory(r.resourceType),
        }
      })
  }, [resources, needs])

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            title="Sugerencias de inventario"
            subtitle="Stock bajo el mínimo recomendado"
            icon={AlertTriangle}
          />
          {suggestions.map((s) => (
            <GlassCard key={s.resourceType} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{s.label}</p>
                <p className="text-xs text-warning">
                  Disponible: {s.available} · Mínimo: {s.min}
                </p>
              </div>
              <EmergencyButton
                variant="primary"
                size="sm"
                onClick={() =>
                  onCreateNeed?.({
                    categoryKey: s.categoryKey,
                    itemName: s.label,
                    quantity: s.deficit,
                  })
                }
              >
                Crear necesidad
              </EmergencyButton>
            </GlassCard>
          ))}
        </div>
      )}

      <CoordinatorNeedsModule onCreateNeed={() => onCreateNeed?.()} />
    </div>
  )
}
