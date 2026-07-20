import { useState } from 'react'
import { Heart } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { SectionHeader } from '@/components/coordinator/section-header'
import { UserSearchInput } from './user-search-input'
import { UserDetailCard } from './user-detail-card'
import { IntentSelector } from './intent-selector'
import { useToast } from '@/store/toast-context'
import { changeParticipationIntent, PARTICIPATION_INTENT_LABELS, type DevProfileRow } from '@/services/dev-service'

type IntentValue = 'need_help' | 'want_to_help' | 'represent_org' | null

export function IntentLabModule() {
  const { showToast } = useToast()
  const [selectedUser, setSelectedUser] = useState<DevProfileRow | null>(null)
  const [loading, setLoading] = useState(false)

  const handleIntentChange = async (intent: IntentValue) => {
    if (!selectedUser) return
    setLoading(true)
    try {
      const updated = await changeParticipationIntent(selectedUser.id, intent)
      setSelectedUser(updated)
      const label = intent ? PARTICIPATION_INTENT_LABELS[intent] : 'Sin definir'
      showToast(`Intención de ${updated.full_name} actualizada: ${label}`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      showToast(`Error: ${message}`, 'warning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Intención de Participación"
        subtitle="Define la intención de cada usuario en la plataforma"
        icon={Heart}
      />

      <GlassCard className="space-y-2">
        <p className="text-xs text-ink-subtle">
          La intención de participación indica qué rol espera tener el usuario en la plataforma.
          Este campo es útil para métricas, analítica y futuras automatizaciones.
        </p>
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-ink-subtle">Necesito ayuda</span>
            <span className="text-ink-faint">— Ciudadano que requiere asistencia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-operational" />
            <span className="text-ink-subtle">Quiero ayudar</span>
            <span className="text-ink-faint">— Voluntario o colaborador</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-info" />
            <span className="text-ink-subtle">Represento una organización</span>
            <span className="text-ink-faint">— ONG, gobierno, comunidad</span>
          </div>
        </div>
      </GlassCard>

      <UserSearchInput onSelect={setSelectedUser} />

      {selectedUser && (
        <div className="space-y-4">
          <UserDetailCard user={selectedUser} />

          <GlassCard className="space-y-3">
            <p className="text-sm font-medium text-ink">Intención de participación</p>
            <p className="text-xs text-ink-faint">
              Actual: {selectedUser.participation_intent
                ? PARTICIPATION_INTENT_LABELS[selectedUser.participation_intent]
                : 'Sin definir'}
            </p>
            <IntentSelector
              value={selectedUser.participation_intent as IntentValue}
              onChange={handleIntentChange}
              disabled={loading}
            />
          </GlassCard>
        </div>
      )}

      {!selectedUser && (
        <GlassCard className="py-8 text-center text-sm text-ink-muted">
          Busca un usuario para definir su intención de participación
        </GlassCard>
      )}
    </div>
  )
}
