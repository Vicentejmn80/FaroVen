import { useState } from 'react'
import { ExternalLink, Pencil } from 'lucide-react'
import { EditCenterSheet } from '@/components/admin/edit-center-sheet'
import {
  CenterActions,
  CenterProfileHeader,
  CenterStatusSummary,
  CitizenReportsPreview,
  CriticalNeedsSection,
  HumanCapacityCard,
  InventoryCapacityCard,
  InventoryHighlights,
} from '@/components/center/center-profile-sections'
import { CenterActivityTimeline } from '@/components/trust/center-activity-timeline'
import { CenterTrustProfile } from '@/components/trust/center-trust-profile'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { MapCanvas } from '@/components/faro/map-canvas'
import { buildMapLink, openExternalNavigation, timeAgo } from '@/lib/utils'
import { SITE_META } from '@/lib/status-config'
import type { Need, Site } from '@/lib/types'
import { useFaro } from '@/store/faro-context'
import { useCenterTrust } from '@/hooks/useCenterTrust'

/**
 * Detalle de Centro — ficha completa. Mismo lenguaje visual: mapa,
 * estado, prioridad, necesidades, historial y fuentes verificadas.
 */
export function CenterDetailScreen({
  site,
  onBack,
  canEdit,
  onReport,
}: {
  site: Site
  onBack: () => void
  canEdit?: boolean
  onReport?: () => void
}) {
  const { state } = useFaro()
  const [editing, setEditing] = useState(false)
  const trust = useCenterTrust(site)
  const center = state.centers.find((item) => item.id === site.id)
  const centerReports = state.reports
    .filter((report) => report.centerId === site.id && report.status !== 'discarded')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const showPeopleCapacity = site.type === 'shelter'
  const capacityCurrent = center?.capacity.current ?? 0
  const capacityTotal = center?.capacity.total ?? 0
  const capacityPct = capacityTotal ? Math.min(100, Math.round((capacityCurrent / capacityTotal) * 100)) : 0
  const confidenceLabel = site.verified ? 'Verificado' : 'Pendiente'
  const highestPriority =
    site.needs.find((need) => need.priority === 'critical')?.priority ??
    site.needs.find((need) => need.priority === 'high')?.priority ??
    site.needs[0]?.priority
  const priorityLabel = highestPriority === 'critical' ? 'Alta' : highestPriority === 'high' ? 'Media' : 'Baja'
  const centerNeeds: Need[] = state.needs.filter((need) => need.centerId === site.id)
  const activeNeeds = centerNeeds.filter(
    (need) => isActiveNeed(need) && need.available < need.required,
  )
  const criticalNeeds = activeNeeds
    .filter((need) => need.priority === 'critical' || need.priority === 'high')
    .sort((a, b) => {
      const scoreA = (a.priority === 'critical' ? 2 : 1) * 100 + (a.required - a.available)
      const scoreB = (b.priority === 'critical' ? 2 : 1) * 100 + (b.required - b.available)
      return scoreB - scoreA
    })
  const avgCoverage = activeNeeds.length
    ? Math.round(
        activeNeeds.reduce(
          (sum, need) => sum + Math.round((need.available / Math.max(need.required, 1)) * 100),
          0,
        ) / activeNeeds.length,
      )
    : 100
  const inventoryHighlights = Array.from(
    new Set(
      [...activeNeeds]
        .sort((a, b) => (b.priority === 'critical' ? 1 : 0) - (a.priority === 'critical' ? 1 : 0))
        .slice(0, 5)
        .map((need) => need.type),
    ),
  )
  const statusSummary = buildHumanStatusSummary(site, activeNeeds.length)
  const onShare = async () => {
    const text = `${site.name} · ${center?.location.address ?? site.zone}. Actualizado ${timeAgo(site.updatedAt)}.`
    const url = buildMapLink(site.lat, site.lng) ?? window.location.href
    if (navigator.share) {
      await navigator.share({ title: site.name, text, url })
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
  }
  const onReportClick = () => {
    if (onReport) {
      onReport()
      return
    }
    window.dispatchEvent(new CustomEvent('faro:navigate-tab', { detail: { tab: 'reports' } }))
  }

  return (
    <ScreenScaffold
      title={site.name}
      subtitle={`${SITE_META[site.type].label} · ${site.zone}`}
      onBack={onBack}
    >
      <div className="space-y-4 pt-1">
        <CenterProfileHeader
          site={site}
          address={center?.location.address ?? site.zone}
          confidence={confidenceLabel}
          priority={priorityLabel}
        />
        {trust && <CenterTrustProfile snapshot={trust} />}
        <CenterStatusSummary summary={statusSummary} />

        <div className="relative h-44 overflow-hidden rounded-4xl ring-1 ring-inset ring-white/10">
          <MapCanvas sites={[{ ...site, mapX: 0.5, mapY: 0.5 }]} />
        </div>

        <div className={showPeopleCapacity ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'grid grid-cols-1 gap-3'}>
          {showPeopleCapacity && (
            <HumanCapacityCard pct={capacityPct} current={capacityCurrent} total={capacityTotal} />
          )}
          <InventoryCapacityCard availabilityPct={avgCoverage} />
        </div>

        {buildMapLink(site.lat, site.lng) ? (
          <a
            href={buildMapLink(site.lat, site.lng)!}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <EmergencyButton variant="primary" size="lg" className="w-full">
              <ExternalLink className="h-[18px] w-[18px]" /> Abrir en OpenStreetMap
            </EmergencyButton>
          </a>
        ) : null}

        <CriticalNeedsSection needs={criticalNeeds} />
        <InventoryHighlights items={inventoryHighlights} />
        {trust && <CenterActivityTimeline items={trust.timeline} />}
        <CitizenReportsPreview reports={centerReports.slice(0, 5)} />

        {center?.photos.length ? (
          <section className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Fotografías
            </p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {center.photos.map((photo) => (
                <GlassCard
                  key={photo.id}
                  inset={false}
                  className={`min-w-[170px] overflow-hidden rounded-3xl bg-gradient-to-br ${photo.tintClass}`}
                >
                  <div className="h-24 bg-black/10" />
                  <p className="px-3 py-2 text-xs text-ink">{photo.caption}</p>
                </GlassCard>
              ))}
            </div>
          </section>
        ) : null}

        <CenterActions
          onNavigate={() =>
            openExternalNavigation({
              lat: site.lat,
              lng: site.lng,
              name: site.name,
              address: center?.location.address ?? site.zone,
            })
          }
          onShare={onShare}
          onReport={onReport ? onReportClick : undefined}
        />

        {canEdit && site.type !== 'organization' && (
          <EmergencyButton variant="glass" size="lg" className="w-full" onClick={() => setEditing(true)}>
            <Pencil className="h-[18px] w-[18px]" /> Editar centro
          </EmergencyButton>
        )}
      </div>

      {editing && (
        <EditCenterSheet
          site={site}
          center={center}
          onClose={() => setEditing(false)}
        />
      )}
    </ScreenScaffold>
  )
}

function buildHumanStatusSummary(site: Site, activeNeeds: number) {
  if (site.status === 'critical') {
    return `Centro en estado crítico. Actualmente prioriza la atención de casos urgentes y requiere coordinación inmediata de recursos en ${site.zone}.`
  }
  if (site.status === 'warning') {
    return `Centro operativo con presión elevada. Mantiene atención activa y recibe apoyo focalizado para cubrir necesidades prioritarias.`
  }
  if (activeNeeds > 0) {
    return `Centro operativo. Actualmente recibe donaciones focalizadas para ${activeNeeds} necesidad(es) activa(s), con actualizaciones continuas del coordinador.`
  }
  return 'Centro operativo. La atención y logística se mantienen estables, con monitoreo continuo para responder a nuevos cambios.'
}

function isActiveNeed(need: Need) {
  return need.status !== 'pending_closure' && need.status !== 'resolved'
}
