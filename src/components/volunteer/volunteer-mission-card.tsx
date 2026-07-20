import type { Mission, MissionAssignment } from '@/domain/mission.types'
import { MISSION_STAGE_LABELS, MISSION_STAGE_TONES } from '@/domain/mission.types'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn, timeAgo } from '@/lib/utils'

function statusTone(status: string): string {
  return MISSION_STAGE_TONES[status as keyof typeof MISSION_STAGE_TONES] ?? 'bg-white/10 text-ink-faint'
}

function statusLabel(status: string): string {
  return MISSION_STAGE_LABELS[status as keyof typeof MISSION_STAGE_LABELS] ?? status
}

export function VolunteerMissionCard({
  mission,
  assignment,
  onAccept,
  onReject,
  onUpdateStatus,
}: {
  mission: Mission
  assignment: MissionAssignment
  onAccept?: () => void
  onReject?: () => void
  onUpdateStatus?: (status: 'en_route' | 'on_site' | 'completed') => void
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-ink truncate">{mission.title}</h4>
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusTone(assignment.status))}>
              {statusLabel(assignment.status)}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-0.5">{timeAgo(mission.createdAt)}</p>
        </div>
      </div>

      {mission.description && (
        <p className="text-xs text-ink-muted line-clamp-2 mb-3">{mission.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-faint mb-3">
        <span>Prioridad: {mission.priority}</span>
        <span>&middot;</span>
        <span>{mission.requiredPeople} voluntarios necesarios</span>
      </div>

      {mission.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {mission.requiredSkills.map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-ink-subtle">
              {skill}
            </span>
          ))}
        </div>
      )}

      {onAccept && assignment.status === 'assigned' && (
        <div className="flex gap-2">
          <EmergencyButton variant="primary" size="sm" onClick={onAccept}>Aceptar misión</EmergencyButton>
          <EmergencyButton variant="glass" size="sm" onClick={onReject}>Rechazar</EmergencyButton>
        </div>
      )}

      {onUpdateStatus && assignment.status === 'accepted' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('en_route')}>
          En camino
        </EmergencyButton>
      )}

      {onUpdateStatus && assignment.status === 'en_route' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('on_site')}>
          Llegué al sitio
        </EmergencyButton>
      )}

      {onUpdateStatus && assignment.status === 'on_site' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('completed')}>
          Finalizar
        </EmergencyButton>
      )}
    </GlassCard>
  )
}
