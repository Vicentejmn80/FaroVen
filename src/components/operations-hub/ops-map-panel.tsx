import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { MapCanvas } from '@/components/faro/map-canvas'
import { cn } from '@/lib/utils'
import { label, PIPELINE_LABELS } from '@/lib/labels'
import type { CaseDomain } from '@/domain/case-lifecycle.types'
import type { Site } from '@/lib/types'

interface OpsMapPanelProps {
  selectedCase: CaseDomain | null
  cases: CaseDomain[]
  sites: Site[]
  onSelectCase?: (caseItem: CaseDomain) => void
  className?: string
}

function caseToSite(caseItem: CaseDomain): Site | null {
  const lat = caseItem.location.lat
  const lng = caseItem.location.lng
  if (lat == null || lng == null) return null

  return {
    id: `case-${caseItem.id}`,
    name: caseItem.title,
    type: 'organization',
    status:
      caseItem.priority === 'critical' || caseItem.priority === 'high'
        ? 'critical'
        : caseItem.priority === 'medium'
          ? 'warning'
          : 'info',
    statusLabel: label(PIPELINE_LABELS, caseItem.pipelineStage),
    zone: caseItem.location.zone || caseItem.zone,
    lat,
    lng,
    mapX: 0,
    mapY: 0,
    needs: [],
    updatedAt: caseItem.updatedAt,
    verified: true,
  }
}

export function OpsMapPanel({
  selectedCase,
  cases,
  sites,
  onSelectCase,
  className,
}: OpsMapPanelProps) {
  const caseSites = useMemo(
    () => cases.map(caseToSite).filter((site): site is Site => site !== null),
    [cases],
  )

  const mapSites = useMemo(() => {
    const siteIds = new Set(sites.map((s) => s.id))
    const extraCases = caseSites.filter((s) => !siteIds.has(s.id))
    return [...sites, ...extraCases]
  }, [sites, caseSites])

  const activeId = selectedCase ? `case-${selectedCase.id}` : null

  const handleSelect = (site: Site) => {
    if (!site.id.startsWith('case-')) return
    const caseId = site.id.replace(/^case-/, '')
    const match = cases.find((c) => c.id === caseId)
    if (match) onSelectCase?.(match)
  }

  const casesWithoutCoords = cases.filter((c) => c.location.lat == null || c.location.lng == null).length

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <MapCanvas
        sites={mapSites}
        activeId={activeId}
        onSelect={handleSelect}
        className="h-full w-full"
        autoFit={mapSites.length > 0}
      />

      {!selectedCase && caseSites.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[240px] rounded-2xl border border-white/10 bg-base-900/85 px-3 py-2 backdrop-blur-md">
          <p className="text-xs text-ink-muted">Toca un marcador de caso para ver detalle y acciones.</p>
        </div>
      )}

      {selectedCase && (selectedCase.location.lat == null || selectedCase.location.lng == null) && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-warning">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>Este caso no tiene coordenadas. El mapa sigue siendo interactivo.</span>
          </div>
        </div>
      )}

      {casesWithoutCoords > 0 && !selectedCase && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/10 bg-base-900/80 px-3 py-2 text-center backdrop-blur-md lg:bottom-16">
          <p className="text-[11px] text-ink-subtle">
            {casesWithoutCoords} caso{casesWithoutCoords === 1 ? '' : 's'} sin ubicación en mapa
          </p>
        </div>
      )}
    </div>
  )
}
