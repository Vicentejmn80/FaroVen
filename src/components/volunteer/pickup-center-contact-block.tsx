import { Building2, Clock, MapPin, Phone, User } from 'lucide-react'
import { usePickupCenterInfo } from '@/hooks/usePickupCenterInfo'
import { cn } from '@/lib/utils'

export function PickupCenterContactBlock({
  centerId,
  fallbackAddress,
  className,
}: {
  centerId?: string | null
  fallbackAddress?: string | null
  className?: string
}) {
  const { data: center } = usePickupCenterInfo(centerId)

  if (!centerId && !fallbackAddress) return null

  const address = center?.address ?? fallbackAddress
  const mapsUrl =
    center?.lat != null && center?.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null

  return (
    <div className={cn('space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Centro de recogida</p>
      <p className="text-sm font-medium text-ink">{center?.name ?? 'Centro asignado'}</p>
      {address && (
        <p className="flex items-start gap-1.5 text-xs text-ink-muted">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{address}</span>
        </p>
      )}
      {center?.contactName && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <User className="h-3 w-3 shrink-0" />
          {center.contactName}
        </p>
      )}
      {center?.phone && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Phone className="h-3 w-3 shrink-0" />
          <a href={`tel:${center.phone}`} className="text-info hover:underline">
            {center.phone}
          </a>
        </p>
      )}
      {center?.schedule && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Clock className="h-3 w-3 shrink-0" />
          {center.schedule}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {center?.phone && (
          <a
            href={`tel:${center.phone}`}
            className="inline-flex items-center gap-1 rounded-lg bg-operational/15 px-2.5 py-1.5 text-[11px] font-medium text-operational hover:bg-operational/25"
          >
            <Phone className="h-3 w-3" />
            Llamar
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-info/15 px-2.5 py-1.5 text-[11px] font-medium text-info hover:bg-info/25"
          >
            <Building2 className="h-3 w-3" />
            Cómo llegar
          </a>
        )}
      </div>
    </div>
  )
}
