import { useState, useRef } from 'react'
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
import { Upload } from 'lucide-react'
import { motion } from 'framer-motion'

function statusTone(status: string): string {
  return MISSION_STAGE_TONES[status as keyof typeof MISSION_STAGE_TONES] ?? 'bg-white/10 text-ink-faint'
}

export function VolunteerMissionCard({
  mission,
  assignment,
  onAccept,
  onReject,
  onUpdateStatus,
  onApply,
  applied,
  onEvidenceSubmit,
  evidencePending,
}: {
  mission: Mission
  assignment: MissionAssignment
  onAccept?: () => void
  onReject?: () => void
  onUpdateStatus?: (status: 'preparing' | 'en_route' | 'on_site' | 'in_progress' | 'completed') => void
  onApply?: () => void
  applied?: boolean
  onEvidenceSubmit?: (urls: string[]) => void
  evidencePending?: boolean
}) {
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(assignment.evidenceUrls)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddUrl = () => {
    if (evidenceUrl.trim()) {
      setEvidenceUrls((prev) => [...prev, evidenceUrl.trim()])
      setEvidenceUrl('')
    }
  }

  const handleSubmitEvidence = () => {
    if (evidenceUrls.length > 0 && onEvidenceSubmit) {
      onEvidenceSubmit(evidenceUrls)
    }
  }

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}>
    <GlassCard className="p-4 transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
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

      {onApply && (
        <EmergencyButton variant="glass" size="sm" onClick={onApply} disabled={applied}>
          {applied ? 'Postulado' : 'Postularme'}
        </EmergencyButton>
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
        <div className="flex gap-2">
          <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('preparing')}>
            Preparándome
          </EmergencyButton>
          <EmergencyButton variant="glass" size="sm" onClick={() => onUpdateStatus('en_route')}>
            Ya voy en camino
          </EmergencyButton>
        </div>
      )}

      {onUpdateStatus && assignment.status === 'preparing' && (
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
        <div className="flex gap-2">
          <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('in_progress')}>
            Comenzar asistencia
          </EmergencyButton>
        </div>
      )}

      {onUpdateStatus && assignment.status === 'in_progress' && (
        <div className="space-y-2">
          <EmergencyButton variant="primary" size="sm" onClick={() => onUpdateStatus('completed')}>
            Marcar como finalizada
          </EmergencyButton>
        </div>
      )}

      {assignment.status === 'completed' && (
        <div className="space-y-2">
          {evidenceUrls.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {evidenceUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-info underline truncate max-w-[200px]">
                  Evidencia {i + 1}
                </a>
              ))}
            </div>
          )}
          {onEvidenceSubmit && (
            <>
              {!showEvidenceForm ? (
                <EmergencyButton variant="glass" size="sm" onClick={() => setShowEvidenceForm(true)}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Adjuntar evidencia
                </EmergencyButton>
              ) : (
                <div className="space-y-2 bg-white/[0.04] rounded-xl p-3">
                  <p className="text-xs font-medium text-ink">Agregar evidencia</p>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="text"
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                      placeholder="URL de imagen o video..."
                      className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint"
                    />
                    <EmergencyButton variant="glass" size="sm" onClick={handleAddUrl}>
                      +
                    </EmergencyButton>
                  </div>
                  {evidenceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {evidenceUrls.map((_url, i) => (
                        <span key={i} className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-ink-subtle">
                          Archivo {i + 1}
                        </span>
                      ))}
                    </div>
                  )}
                  <EmergencyButton
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitEvidence}
                    disabled={evidenceUrls.length === 0 || evidencePending}
                  >
                    {evidencePending ? 'Enviando...' : `Enviar evidencia (${evidenceUrls.length})`}
                  </EmergencyButton>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </GlassCard>
    </motion.div>
  )
}
