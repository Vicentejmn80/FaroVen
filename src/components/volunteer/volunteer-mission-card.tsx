import type { Mission, MissionAssignment } from '@/domain/mission.types'
import { MISSION_STAGE_TONES } from '@/domain/mission.types'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn, timeAgo } from '@/lib/utils'
import {
  ASSIGNMENT_STATUS_LABELS,
  MISSION_PRIORITY_LABELS,
  MISSION_STAGE_LABELS,
  SKILL_LABELS,
  label,
} from '@/lib/labels'

function statusTone(status: string): string {
  return MISSION_STAGE_TONES[status as keyof typeof MISSION_STAGE_TONES] ?? 'bg-white/10 text-ink-faint'
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
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-ink">{mission.title}</h4>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                statusTone(assignment.status),
              )}
            >
              {label(
                ASSIGNMENT_STATUS_LABELS,
                assignment.status,
                label(MISSION_STAGE_LABELS, assignment.status),
              )}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-subtle">{timeAgo(mission.createdAt)}</p>
        </div>
      </div>

      {mission.description && (
        <p className="mb-3 line-clamp-2 text-xs text-ink-muted">{mission.description}</p>
      )}

      <div className="mb-3 flex items-center gap-2 text-xs text-ink-faint">
        <span>{label(MISSION_PRIORITY_LABELS, mission.priority)}</span>
        <span>&middot;</span>
        <span>{mission.requiredPeople} voluntarios necesarios</span>
      </div>

      {mission.requiredSkills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {mission.requiredSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-ink-subtle"
            >
              {label(SKILL_LABELS, skill, skill)}
            </span>
          ))}
        </div>
      )}

      {onAccept && assignment.status === 'assigned' && (
        <div className="flex gap-2">
          <EmergencyButton variant="primary" size="sm" onClick={onAccept}>
            Aceptar ayuda
          </EmergencyButton>
          <EmergencyButton variant="glass" size="sm" onClick={onReject}>
            No puedo ahora
          </EmergencyButton>
        </div>
      )}

      {onUpdateStatus && assignment.status === 'accepted' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('en_route')}>
          Voy en camino
        </EmergencyButton>
      )}

      {onUpdateStatus && assignment.status === 'en_route' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('on_site')}>
          Llegué al sitio
        </EmergencyButton>
      )}

      {onUpdateStatus && assignment.status === 'on_site' && (
        <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('completed')}>
          Marcar como finalizada
        </EmergencyButton>
      )}
    </GlassCard>
  )
}
