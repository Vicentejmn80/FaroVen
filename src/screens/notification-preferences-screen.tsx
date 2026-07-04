import { Bell, ChevronRight } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { PushPermissionModal } from '@/components/notifications/PushPermissionModal'
import type { MuteDuration } from '@/domain/notification-models'
import {
  useNotificationPreferenceMutations,
  useNotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { pushService } from '@/push-service/push-service'

interface NotificationPreferencesScreenProps {
  onBack: () => void
}

const CATEGORIES: Array<{ key: keyof typeof CATEGORY_DEFAULTS; label: string; description: string }> = [
  { key: 'requests_enabled', label: 'Solicitudes', description: 'Coordinadores y aprobaciones' },
  { key: 'reports_enabled', label: 'Reportes', description: 'Reportes ciudadanos y verificaciones' },
  { key: 'messages_enabled', label: 'Mensajes', description: 'Contacto y respuestas del equipo FARO' },
  { key: 'emergencies_enabled', label: 'Emergencias', description: 'Necesidades críticas y entregas' },
  { key: 'system_enabled', label: 'Sistema', description: 'Registros, administradores y alertas internas' },
  { key: 'verified_news_enabled', label: 'Noticias verificadas', description: 'Información confirmada por FARO' },
  { key: 'nearby_centers_enabled', label: 'Centros cercanos', description: 'Actividad en tu zona (próximamente)' },
]

const CATEGORY_DEFAULTS = {
  requests_enabled: true,
  reports_enabled: true,
  messages_enabled: true,
  emergencies_enabled: true,
  system_enabled: true,
  verified_news_enabled: true,
  nearby_centers_enabled: true,
  push_enabled: false,
} as const

const MUTE_OPTIONS: Array<{ id: MuteDuration; label: string }> = [
  { id: '30m', label: '30 minutos' },
  { id: '1h', label: '1 hora' },
  { id: '8h', label: '8 horas' },
  { id: '24h', label: '24 horas' },
]

export function NotificationPreferencesScreen({ onBack }: NotificationPreferencesScreenProps) {
  const { data: prefs, isLoading } = useNotificationPreferences()
  const { update, setMute, clearMute } = useNotificationPreferenceMutations()
  const push = usePushNotifications()
  const pushAvailable = pushService.isAvailable()

  const values = { ...CATEGORY_DEFAULTS, ...prefs }

  const toggle = (key: keyof typeof CATEGORY_DEFAULTS) => {
    void update.mutate({ [key]: !values[key] })
  }

  const handlePushToggle = () => {
    if (values.push_enabled) {
      void update.mutate({ push_enabled: false })
      return
    }
    push.openPermissionModal()
  }

  const mutedUntil = prefs?.muted_until ? new Date(prefs.muted_until) : null
  const isMuted = mutedUntil ? mutedUntil.getTime() > Date.now() : false

  return (
    <ScreenScaffold title="Preferencias de notificaciones" subtitle="Controla qué alertas recibes" onBack={onBack}>
      <div className="space-y-4 pt-2">
        <GlassCard className="space-y-2">
          <ToggleRow
            label="Alertas push en este dispositivo"
            description={
              pushAvailable
                ? 'Recibe avisos aunque FARO no esté abierto'
                : 'Disponible en HTTPS (faro-ven.vercel.app). Pulsa Activar para intentar.'
            }
            checked={values.push_enabled}
            onChange={handlePushToggle}
          />
          {!pushAvailable && !values.push_enabled && (
            <EmergencyButton variant="primary" size="sm" className="w-full" onClick={push.openPermissionModal}>
              Activar alertas push
            </EmergencyButton>
          )}
          {push.accepting && (
            <p className="px-1 text-xs text-ink-muted">Registrando dispositivo…</p>
          )}
        </GlassCard>

        <GlassCard className="space-y-1">
          <p className="text-sm font-medium text-ink">Categorías</p>
          {isLoading ? (
            <p className="text-sm text-ink-muted">Cargando…</p>
          ) : (
            CATEGORIES.map((cat) => (
              <ToggleRow
                key={cat.key}
                label={cat.label}
                description={cat.description}
                checked={Boolean(values[cat.key])}
                onChange={() => toggle(cat.key)}
              />
            ))
          )}
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ink-muted" />
            <p className="text-sm font-medium text-ink">Silenciar temporalmente</p>
          </div>
          {isMuted && mutedUntil && (
            <p className="text-xs text-warning">
              Silenciado hasta {mutedUntil.toLocaleString('es-VE')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {MUTE_OPTIONS.map((opt) => (
              <EmergencyButton
                key={opt.id}
                variant="glass"
                size="sm"
                onClick={() => void setMute.mutate(opt.id)}
              >
                {opt.label}
              </EmergencyButton>
            ))}
          </div>
          {isMuted && (
            <EmergencyButton variant="glass" size="sm" className="w-full" onClick={() => void clearMute.mutate()}>
              Quitar silencio
            </EmergencyButton>
          )}
        </GlassCard>
      </div>
      <PushPermissionModal
        open={push.modalOpen}
        loading={push.accepting}
        onAccept={() => void push.acceptPush()}
        onDismiss={push.dismissModal}
      />
    </ScreenScaffold>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex-1">
        <span className="block text-[15px] text-ink">{label}</span>
        <span className="block text-xs text-ink-subtle">{description}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-info' : 'bg-white/15'}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </span>
      <ChevronRight className="h-4 w-4 text-ink-faint opacity-0" aria-hidden />
    </button>
  )
}
