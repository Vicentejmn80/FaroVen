import { GlassCard } from '@/components/ui/glass-card'
import { MapPin, Navigation } from 'lucide-react'
import { useGeolocation, haversineDistance, formatDistance, estimateTravelTime } from '@/hooks/useGeolocation'
import { OP_LABELS } from '@/lib/labels'

interface LiveTrackingCardProps {
  missionLat?: number
  missionLng?: number
  missionAddress?: string
  volunteerUserId?: string
}

function TrackingSkeleton() {
  return (
    <GlassCard className="space-y-3 p-4" aria-busy="true" aria-label={OP_LABELS.loading}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[0.08]" />
        <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
      </div>
      <div className="h-10 animate-pulse rounded-2xl bg-info/10" />
      <div className="h-10 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="h-3 w-48 animate-pulse rounded bg-white/[0.05]" />
    </GlassCard>
  )
}

export function LiveTrackingCard({ missionLat, missionLng, missionAddress, volunteerUserId }: LiveTrackingCardProps) {
  const { position, error, loading, requestPermission, watching } = useGeolocation(volunteerUserId)

  if (!missionLat || !missionLng) {
    return (
      <GlassCard className="flex flex-col items-center gap-2 p-5 text-center">
        <MapPin className="h-7 w-7 text-ink-faint" strokeWidth={1.5} />
        <p className="text-sm font-medium text-ink">Ubicación de misión no disponible</p>
        <p className="text-xs text-ink-subtle">
          Cuando la misión tenga coordenadas, podrás ver distancia y tiempo estimado en vivo.
        </p>
      </GlassCard>
    )
  }

  if (loading && !position) return <TrackingSkeleton />

  const distance = position
    ? haversineDistance(position.lat, position.lng, missionLat, missionLng)
    : undefined

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-info" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-ink">Seguimiento en vivo</p>
        </div>
        {!watching && !error && (
          <button type="button" onClick={requestPermission}
            className="text-xs font-medium text-info underline">
            Activar ubicación
          </button>
        )}
        {watching && (
          <span className="flex items-center gap-1 text-[10px] text-operational">
            <span className="h-1.5 w-1.5 rounded-full bg-operational animate-pulse" />
            En vivo
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-critical bg-critical/10 rounded-xl px-3 py-2">{error}</p>
      )}

      {position && (
        <div className="space-y-2">
          {distance !== undefined && (
            <div className="flex items-center justify-between rounded-2xl bg-info/10 px-3 py-2">
              <span className="text-xs text-ink-subtle">Distancia</span>
              <span className="text-sm font-semibold tabular-nums text-info">{formatDistance(distance)}</span>
            </div>
          )}
          {distance !== undefined && (
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2">
              <span className="text-xs text-ink-subtle">Tiempo estimado</span>
              <span className="text-sm font-semibold tabular-nums text-ink">{estimateTravelTime(distance)}</span>
            </div>
          )}
        </div>
      )}

      {!position && !error && !loading && (
        <p className="text-xs text-ink-subtle">
          Activa tu ubicación para ver distancia y tiempo estimado hacia el punto de ayuda.
        </p>
      )}

      {missionAddress && (
        <div className="flex items-start gap-2 text-xs text-ink-subtle border-t border-white/[0.06] pt-2">
          <MapPin className="h-3 w-3 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{missionAddress}</span>
        </div>
      )}
    </GlassCard>
  )
}
