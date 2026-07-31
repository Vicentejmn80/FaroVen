import { useEffect, useMemo, useState } from 'react'
import { X, MapPin, PackageCheck } from 'lucide-react'
import type { PublicNeed } from '@/domain/public-need.types'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { resolveCatalogKey, getResourceLabel } from '@/lib/resource-catalog'
import { recommendCenters } from '@/services/logistics-service'
import { useCreateCoverageReservation } from '@/hooks/usePublicNeeds'
import { opsChannelLog } from '@/lib/operational-log'

const QTY_QUICK = [5, 10, 20] as const

export function CoverageCenterReserveModal({
  open,
  publicNeed,
  collaboratorType,
  collaboratorName,
  onClose,
  onReserved,
}: {
  open: boolean
  publicNeed: PublicNeed | null
  collaboratorType: 'citizen' | 'volunteer' | 'organization' | 'coordinator'
  collaboratorName?: string
  onClose: () => void
  onReserved?: () => void
}) {
  const reserve = useCreateCoverageReservation()
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null)
  const [centersLoading, setCentersLoading] = useState(false)
  const [centersError, setCentersError] = useState<string | null>(null)
  const [centers, setCenters] = useState<Array<Awaited<ReturnType<typeof recommendCenters>>[number]>>([])

  const coords = useMemo(() => {
    if (!publicNeed) return null
    const lat = publicNeed.locationPublic.lat
    const lng = publicNeed.locationPublic.lng
    if (lat == null || lng == null) return null
    return { lat, lng }
  }, [publicNeed])

  const resourceType = useMemo(() => {
    if (!publicNeed) return null
    return resolveCatalogKey(publicNeed.category) ?? null
  }, [publicNeed])

  useEffect(() => {
    if (!open) return
    setSelectedCenterId(null)
    setCenters([])
    setCentersError(null)
  }, [open, publicNeed?.id])

  useEffect(() => {
    if (!open) return
    if (!publicNeed) return
    if (!coords) return
    if (!resourceType) return
    let cancelled = false
    setCentersLoading(true)
    setCentersError(null)
    void recommendCenters({
      resourceType,
      minQty: 1,
      missionLat: coords.lat,
      missionLng: coords.lng,
      limit: 8,
    })
      .then((rows) => {
        if (cancelled) return
        setCenters(rows)
        if (!selectedCenterId && rows[0]) setSelectedCenterId(rows[0].centerId)
      })
      .catch((err) => {
        if (cancelled) return
        setCenters([])
        setCentersError(err instanceof Error ? err.message : 'No se pudo consultar centros')
      })
      .finally(() => {
        if (cancelled) return
        setCentersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, publicNeed, coords, resourceType, selectedCenterId])

  const remaining = publicNeed?.remainingQuantity ?? 0
  const canReserve = Boolean(publicNeed && publicNeed.callStatus === 'open' && remaining > 0)

  const selectedCenter = centers.find((c) => c.centerId === selectedCenterId) ?? null
  const maxByCenter = selectedCenter ? Math.max(0, Math.floor(selectedCenter.available)) : Number.POSITIVE_INFINITY
  const maxQty = Math.max(0, Math.min(Math.floor(remaining), maxByCenter))

  const handlePick = async (qty: number) => {
    if (!publicNeed) return
    if (!canReserve) return
    const clamped = Math.max(1, Math.min(Math.floor(qty), maxQty))
    if (clamped <= 0) return

    opsChannelLog('RESERVATION', {
      entityType: 'public_need',
      entityId: publicNeed.id,
      action: 'coverage_reserve_attempt',
      source: 'ui',
      payload: {
        collaboratorType,
        collaboratorName: collaboratorName ?? null,
        quantity: clamped,
        resourceType: resourceType ?? null,
        selectedCenterId,
      },
    })

    await reserve.mutateAsync({
      publicNeedId: publicNeed.id,
      collaboratorType,
      collaboratorName,
      quantity: clamped,
    })

    opsChannelLog('RESERVATION', {
      entityType: 'public_need',
      entityId: publicNeed.id,
      action: 'coverage_reserved',
      source: 'ui',
      payload: {
        collaboratorType,
        quantity: clamped,
        resourceType: resourceType ?? null,
        selectedCenterId,
      },
    })

    onReserved?.()
    onClose()
  }

  if (!open || !publicNeed) return null

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0A0F1A]/95 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink line-clamp-1">{publicNeed.title}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Faltan {publicNeed.remainingQuantity} {publicNeed.unit}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !reserve.isPending && onClose()}
              className="rounded-full p-1.5 text-ink-faint hover:bg-white/[0.06] hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
            <GlassCard className="p-3">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{publicNeed.locationPublic.zone ?? 'Zona por confirmar'}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                <PackageCheck className="h-3.5 w-3.5" />
                <span className="truncate">
                  Recurso: {resourceType ? getResourceLabel(resourceType) : publicNeed.category}
                </span>
              </div>
            </GlassCard>

            {resourceType && coords ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  Centros con recurso disponible
                </p>
                {centersLoading && <GlassCard className="h-16 animate-pulse" />}
                {centersError && <p className="text-xs text-critical">{centersError}</p>}
                {!centersLoading && !centersError && centers.length === 0 && (
                  <p className="text-xs text-ink-muted">
                    No hay centros compatibles ahora. Aún puedes registrar tu compromiso.
                  </p>
                )}
                <div className="space-y-2">
                  {centers.map((c) => (
                    <button
                      key={c.centerId}
                      type="button"
                      onClick={() => setSelectedCenterId(c.centerId)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition-all',
                        selectedCenterId === c.centerId
                          ? 'border-info/50 bg-info/10'
                          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{c.centerName}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {c.distanceKm} km · {c.operationalMode}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-operational">
                          {c.available} {c.unit}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                Esta convocatoria no tiene un recurso estándar o coordenadas públicas. Puedes reservar, pero no podemos listar centros.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                ¿Con cuántas unidades te comprometes?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QTY_QUICK.map((qty) => (
                  <EmergencyButton
                    key={qty}
                    variant="glass"
                    size="sm"
                    disabled={!canReserve || reserve.isPending || qty > maxQty}
                    onClick={() => void handlePick(qty)}
                  >
                    {qty} {publicNeed.unit}
                  </EmergencyButton>
                ))}
                <EmergencyButton
                  variant="primary"
                  size="sm"
                  disabled={!canReserve || reserve.isPending || maxQty <= 0}
                  onClick={() => void handlePick(maxQty)}
                >
                  Todo lo pendiente ({maxQty})
                </EmergencyButton>
              </div>
              <p className="text-[11px] text-ink-muted">
                Tu reserva bloquea la cantidad en la convocatoria y se refleja en tiempo real.
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-4">
            <EmergencyButton
              variant="glass"
              size="sm"
              className="w-full"
              onClick={onClose}
              disabled={reserve.isPending}
            >
              Cerrar
            </EmergencyButton>
          </div>
        </div>
      </div>
    </div>
  )
}

