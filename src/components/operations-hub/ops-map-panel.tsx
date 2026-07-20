import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { MapCanvas } from '@/components/faro/map-canvas'
import { cn } from '@/lib/utils'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import type { Site } from '@/lib/types'

interface OpsMapPanelProps {
  selectedCase: CaseDomain | null
  sites: Site[]
  className?: string
}

export function OpsMapPanel({ selectedCase, sites, className }: OpsMapPanelProps) {
  const activeSiteId = selectedCase?.assignedCenterId ?? null

  const caseSites = useMemo(() => {
    if (!selectedCase?.location.lat || !selectedCase?.location.lng) return sites
    const virtualSite: Site = {
      id: `case-${selectedCase.id}`,
      name: selectedCase.title,
      type: 'organization',
      status: selectedCase.priority === 'critical' || selectedCase.priority === 'high' ? 'critical' : selectedCase.priority === 'medium' ? 'warning' : 'info',
      statusLabel: selectedCase.pipelineStage,
      zone: selectedCase.location.zone || selectedCase.zone,
      lat: selectedCase.location.lat,
      lng: selectedCase.location.lng,
      mapX: 0,
      mapY: 0,
      needs: [],
      updatedAt: selectedCase.updatedAt,
      verified: true,
    }
    return [...sites, virtualSite]
  }, [sites, selectedCase])

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <MapCanvas
        sites={caseSites}
        activeId={activeSiteId ?? undefined}
        onSelect={() => {}}
        className="h-full w-full"
      />
      {selectedCase && !selectedCase.location.lat && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1626]/80">
          <div className="text-center px-6">
            <MapPin className="mx-auto h-8 w-8 text-ink-muted" />
            <p className="mt-2 text-sm text-ink-muted">
              Este caso no tiene coordenadas para mostrar en el mapa
            </p>
          </div>
        </div>
      )}
      {!selectedCase && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1626]/80">
          <div className="text-center px-6">
            <MapPin className="mx-auto h-8 w-8 text-ink-muted" />
            <p className="mt-2 text-sm text-ink-muted">
              Selecciona un caso para ver su ubicación
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
