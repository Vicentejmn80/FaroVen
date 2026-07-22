import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { MapPin, Clock, Star, Phone, Check, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { MissionApplicationWithVolunteer } from '@/domain/mission-application.types'
import { formatDistance, estimateTravelTime } from '@/hooks/useGeolocation'
import { label, APPLICATION_STATUS_LABELS } from '@/lib/labels'

function TrustBadge({ score }: { score?: number }) {
  if (score === undefined) return null
  const stars = score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Muy recomendado' : score >= 40 ? 'Disponible' : score >= 20 ? 'Nuevo' : 'Principiante'

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-subtle">
      {Array.from({ length: stars }, (_, i) => <Star key={i} className="h-3 w-3 text-warning" fill="currentColor" />)}
      {label}
    </span>
  )
}

export function ApplicationCard({
  application,
  onApprove,
  onReject,
}: {
  application: MissionApplicationWithVolunteer
  onApprove?: () => void
  onReject?: () => void
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}>
    <GlassCard className={cn(
      'p-4 space-y-3 transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]',
      application.status === 'approved' ? 'ring-1 ring-operational/30' : application.status === 'rejected' ? 'ring-1 ring-critical/20' : '',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-ink truncate">{application.volunteerName}</p>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              application.status === 'approved' ? 'bg-operational/20 text-operational' :
              application.status === 'rejected' ? 'bg-critical/20 text-critical' :
              'bg-warning/20 text-warning',
            )}>{label(APPLICATION_STATUS_LABELS, application.status, application.status)}</span>
          </div>
          <TrustBadge score={application.trustScore} />
        </div>
        {application.status === 'pending' && onApprove && onReject && (
          <div className="flex gap-1.5 shrink-0">
            <EmergencyButton variant="glass" size="sm" onClick={onApprove} className="text-operational hover:bg-operational/20">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </EmergencyButton>
            <EmergencyButton variant="glass" size="sm" onClick={onReject} className="text-critical hover:bg-critical/20">
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </EmergencyButton>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-subtle">
        {application.distanceKm !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            {formatDistance(application.distanceKm)}
          </span>
        )}
        {application.etaMinutes !== undefined && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            {estimateTravelTime(application.distanceKm ?? 0)}
          </span>
        )}
        {application.volunteerPhone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" strokeWidth={1.5} />
            {application.volunteerPhone}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-ink-faint">
        {application.totalMissions !== undefined && <span>{application.totalMissions} misiones</span>}
        {application.completedMissions !== undefined && <span>{application.completedMissions} exitosas</span>}
        {application.serviceHours !== undefined && <span>{application.serviceHours}h servicio</span>}
        {application.avgResponseMin !== undefined && <span>Respuesta: {application.avgResponseMin}min</span>}
      </div>

      {application.notes && (
        <p className="text-xs text-ink-subtle italic border-t border-white/[0.06] pt-2">{application.notes}</p>
      )}
    </GlassCard>
    </motion.div>
  )
}
