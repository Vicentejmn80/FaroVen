import { useEffect, useState } from 'react'
import { Building2, ClipboardList, HeartHandshake, Loader2 } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { textareaClassName } from '@/components/faro/flow-sheet'
import { FARO_ROLE_LABELS, FARO_ROLES, type RequestableNetworkRole } from '@/lib/roles'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth-context'

type Choice = 'volunteer' | RequestableNetworkRole

const ROLE_CARDS: Array<{
  id: Choice
  title: string
  description: string
  icon: typeof HeartHandshake
  immediate: boolean
}> = [
  {
    id: 'volunteer',
    title: 'Voluntario',
    description: 'Quiero ayudar en el terreno y recibir misiones cuando estén disponibles.',
    icon: HeartHandshake,
    immediate: true,
  },
  {
    id: FARO_ROLES.CASE_MANAGER,
    title: 'Gestor de Casos',
    description: 'Revisar reportes ciudadanos, validar información y dar seguimiento a casos.',
    icon: ClipboardList,
    immediate: false,
  },
  {
    id: FARO_ROLES.COORDINATOR,
    title: 'Coordinador',
    description: 'Representar un centro u organización y gestionar su operación en FARO.',
    icon: Building2,
    immediate: false,
  },
]

/**
 * Paso post-verificación de email: elegir rol de Red de Apoyo.
 * Voluntario = inmediato. Gestor/Coordinador = solicitud pending.
 */
export function RoleSelectionScreen() {
  const {
    selectVolunteerRole,
    requestNetworkRole,
    pendingAuthIntent,
    clearPendingAuthIntent,
  } = useAuth()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmedBanner, setConfirmedBanner] = useState(false)

  // Feedback al llegar desde el link de confirmación de Supabase
  useEffect(() => {
    if (pendingAuthIntent === 'email_confirmation') {
      setConfirmedBanner(true)
      clearPendingAuthIntent()
    }
  }, [pendingAuthIntent, clearPendingAuthIntent])

  const selectedCard = ROLE_CARDS.find((c) => c.id === choice)
  const needsReason = selectedCard && !selectedCard.immediate

  const handleConfirm = async () => {
    if (!choice) return
    setBusy(true)
    setError(null)
    try {
      if (choice === 'volunteer') {
        await selectVolunteerRole()
      } else {
        if (reason.trim().length < 12) {
          throw new Error('Cuéntanos un poco más sobre tu experiencia o vínculo (mínimo 12 caracteres).')
        }
        await requestNetworkRole(choice, reason.trim())
      }
      // El gate en App.tsx sale solo cuando needsRoleSelection pasa a false
    } catch (err) {
      setError(humanizeSupabaseError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1626] px-4 py-8 text-[#F2F6FA] lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <FaroIcon size={48} title="FARO" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7690AC]">
              Red de Apoyo FARO
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#F2F6FA]">
              ¿Cómo quieres participar?
            </h1>
          </div>
        </div>

        {confirmedBanner && (
          <p className="mb-4 rounded-[12px] border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-2 text-sm text-[#2DD4BF]">
            Correo confirmado. Elige tu rol para continuar.
          </p>
        )}

        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#8CA0B8]">
          Elige el rol que mejor describe tu participación. Los roles de Gestor y Coordinador
          requieren revisión del equipo FARO; mientras tanto podrás usar la app como Voluntario.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon
            const active = choice === card.id
            return (
              <button
                key={card.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setChoice(card.id)
                  setError(null)
                }}
                className={cn(
                  'rounded-[16px] border p-4 text-left transition-colors',
                  active
                    ? 'border-[#2DD4BF]/60 bg-[#2DD4BF]/10'
                    : 'border-[#1C2B40] bg-[#12233A] hover:border-[#223652]',
                )}
              >
                <span
                  className={cn(
                    'mb-3 flex h-11 w-11 items-center justify-center rounded-[12px]',
                    active ? 'bg-[#2DD4BF]/20 text-[#2DD4BF]' : 'bg-[#1C2B40] text-[#8CA0B8]',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-[15px] font-semibold text-[#F2F6FA]">{card.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#7690AC]">{card.description}</p>
                {!card.immediate && (
                  <p className="mt-2 text-[11px] font-medium text-[#FAC775]">Requiere aprobación</p>
                )}
              </button>
            )
          })}
        </div>

        {needsReason && (
          <div className="mt-5 space-y-3 rounded-[16px] border border-[#1C2B40] bg-[#12233A] p-4">
            <p className="text-sm font-medium text-[#F2F6FA]">
              Solicitud: {FARO_ROLE_LABELS[choice as RequestableNetworkRole]}
            </p>
            <p className="text-xs text-[#8CA0B8]">
              Cuéntanos por qué solicitas este rol (organización, experiencia, zona, etc.).
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm text-[#F2F6FA]">Motivo / justificación</span>
              <textarea
                className={textareaClassName}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Trabajo con una ONG en La Guaira y valido reportes de emergencia..."
                disabled={busy}
              />
            </label>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[12px] border border-[#3A1414] bg-[#3A1414]/60 px-3 py-2 text-sm text-[#F7C1C1]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <EmergencyButton
            variant="primary"
            size="lg"
            disabled={!choice || busy || (needsReason && reason.trim().length < 12)}
            className="w-full !bg-[#2DD4BF] !text-[#0B1626] !shadow-none sm:w-auto sm:min-w-[220px]"
            onClick={() => void handleConfirm()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : needsReason ? (
              'Enviar solicitud'
            ) : (
              'Continuar como Voluntario'
            )}
          </EmergencyButton>
        </div>
      </div>
    </div>
  )
}
