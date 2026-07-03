import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Heart,
  Package,
  Warehouse,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import { useRegisterSite } from '@/hooks/useFaroMutations'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { humanizeSupabaseError } from '@/lib/supabase-errors'
import type { RegisterSiteType } from '@/repositories/types'
import { cn } from '@/lib/utils'

interface CreateCenterWizardProps {
  onClose: () => void
  onSuccess?: () => void
}

type WizardStep = 1 | 2 | 3 | 4

const SITE_TYPES: Array<{
  value: RegisterSiteType
  label: string
  description: string
  icon: typeof Building2
  accent: string
}> = [
  {
    value: 'hospital',
    label: 'Hospital',
    description: 'Centro médico y de atención de urgencias',
    icon: Heart,
    accent: 'text-critical',
  },
  {
    value: 'shelter',
    label: 'Refugio',
    description: 'Albergue temporal para afectados',
    icon: Warehouse,
    accent: 'text-warning',
  },
  {
    value: 'supply_center',
    label: 'Acopio',
    description: 'Centro de distribución de insumos',
    icon: Package,
    accent: 'text-operational',
  },
]

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Tipo',
  2: 'Ubicación',
  3: 'Información',
  4: 'Confirmar',
}

export function CreateCenterWizard({ onClose, onSuccess }: CreateCenterWizardProps) {
  const registerSite = useRegisterSite()

  // State
  const [step, setStep] = useState<WizardStep>(1)
  const [type, setType] = useState<RegisterSiteType>('hospital')
  const [place, setPlace] = useState<ResolvedPlace | null>(null)
  const [municipality, setMunicipality] = useState('')
  const [state, setState] = useState('')
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [capacity, setCapacity] = useState('100')
  const [currentOcc, setCurrentOcc] = useState('0')
  const [schedule, setSchedule] = useState('')
  const [observations, setObservations] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Derived
  const selectedType = SITE_TYPES.find((t) => t.value === type)!
  const hasCapacity = type !== 'supply_center'
  const hasSchedule = type === 'supply_center'

  function handleNext() {
    setError(null)
    if (step === 2 && !place) {
      setError('Confirma la ubicación en el mapa.')
      return
    }
    if (step === 3 && name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (step < 4) setStep((prev) => (prev + 1) as WizardStep)
  }

  function handleBack() {
    setError(null)
    if (step > 1) setStep((prev) => (prev - 1) as WizardStep)
  }

  async function handleSubmit() {
    setError(null)
    try {
      await registerSite.mutateAsync({
        type,
        name: name.trim(),
        address: place?.address,
        municipality: municipality.trim() || undefined,
        state: state.trim() || undefined,
        latitude: place?.lat,
        longitude: place?.lng,
        capacity: hasCapacity ? Number(capacity) || 100 : undefined,
        currentOcc: hasCapacity ? Number(currentOcc) || 0 : undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: phone.trim() || undefined,
        schedule: hasSchedule ? schedule.trim() || undefined : undefined,
        observations: observations.trim() || undefined,
      })
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(humanizeSupabaseError(err))
    }
  }

  if (done) {
    return (
      <WizardShell onClose={onClose} step={4} title="Listo">
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3 text-operational">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-ink">{name}</p>
              <p className="text-sm text-ink-muted">Aparecerá en el mapa en segundos</p>
            </div>
          </div>
          {place && (
            <a
              href={place.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-info hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en OpenStreetMap
            </a>
          )}
          <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onClose}>
            Cerrar
          </EmergencyButton>
        </GlassCard>
      </WizardShell>
    )
  }

  return (
    <WizardShell onClose={onClose} step={step} title={STEP_LABELS[step]}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <StepPane key="step1">
            <div className="space-y-3">
              {SITE_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors',
                      type === t.value
                        ? 'border-info/60 bg-info-soft'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]',
                        t.accent,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{t.label}</p>
                      <p className="text-sm text-ink-muted">{t.description}</p>
                    </div>
                    {type === t.value && (
                      <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-info" />
                    )}
                  </button>
                )
              })}
            </div>
            <NavRow onBack={onClose} onNext={handleNext} backLabel="Cancelar" nextLabel="Siguiente" />
          </StepPane>
        )}

        {step === 2 && (
          <StepPane key="step2">
            <div className="space-y-4">
              <GlassCard className="space-y-1 p-3">
                <p className="text-xs font-medium text-ink-muted">Tipo seleccionado</p>
                <p className="font-semibold text-ink">{selectedType.label}</p>
              </GlassCard>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Ubicación en el mapa</span>
                <span className="block text-xs text-ink-subtle">
                  Busca la dirección, usa GPS o toca el mapa para colocar el pin.
                </span>
                <LocationPickerMap
                  value={place}
                  onChange={setPlace}
                  onNameHint={(hint) => {
                    if (!name.trim()) setName(hint)
                  }}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Municipio</span>
                  <input
                    className={fieldClassName}
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    placeholder="Ej. Libertador"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Estado</span>
                  <input
                    className={fieldClassName}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Ej. Miranda"
                  />
                </label>
              </div>

              {error && <p className="text-sm text-critical">{error}</p>}
            </div>
            <NavRow onBack={handleBack} onNext={handleNext} nextDisabled={!place} />
          </StepPane>
        )}

        {step === 3 && (
          <StepPane key="step3">
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">
                  Nombre del {selectedType.label.toLowerCase()}
                  <span className="text-critical"> *</span>
                </span>
                <input
                  className={fieldClassName}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Ej. ${selectedType.label} Central`}
                  autoFocus
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Responsable</span>
                <input
                  className={fieldClassName}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nombre del coordinador"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Teléfono</span>
                <input
                  className={fieldClassName}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 412 000 0000"
                />
              </label>

              {hasCapacity && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Capacidad</span>
                    <input
                      className={fieldClassName}
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-ink">Ocupación actual</span>
                    <input
                      className={fieldClassName}
                      type="number"
                      min={0}
                      value={currentOcc}
                      onChange={(e) => setCurrentOcc(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {hasSchedule && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Horario</span>
                  <input
                    className={fieldClassName}
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Ej. Lun–Vie 8am–5pm"
                  />
                </label>
              )}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Observaciones</span>
                <textarea
                  className={textareaClassName}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Información adicional relevante…"
                  rows={3}
                />
              </label>

              {error && <p className="text-sm text-critical">{error}</p>}
            </div>
            <NavRow onBack={handleBack} onNext={handleNext} nextDisabled={name.trim().length < 2} />
          </StepPane>
        )}

        {step === 4 && (
          <StepPane key="step4">
            <div className="space-y-3">
              <GlassCard className="divide-y divide-white/[0.06] overflow-hidden p-0">
                <ConfirmRow label="Tipo" value={selectedType.label} />
                <ConfirmRow label="Nombre" value={name} />
                <ConfirmRow label="Dirección" value={place?.address ?? '—'} />
                {municipality && <ConfirmRow label="Municipio" value={municipality} />}
                {state && <ConfirmRow label="Estado" value={state} />}
                {contactName && <ConfirmRow label="Responsable" value={contactName} />}
                {phone && <ConfirmRow label="Teléfono" value={phone} />}
                {hasCapacity && (
                  <ConfirmRow label="Capacidad" value={`${currentOcc} / ${capacity}`} />
                )}
                {hasSchedule && schedule && <ConfirmRow label="Horario" value={schedule} />}
                {observations && <ConfirmRow label="Observaciones" value={observations} />}
              </GlassCard>

              {error && <p className="text-sm text-critical">{error}</p>}

              <EmergencyButton
                variant="primary"
                size="lg"
                className="w-full"
                disabled={registerSite.isPending}
                onClick={handleSubmit}
              >
                {registerSite.isPending ? 'Publicando en el mapa…' : 'Confirmar y publicar'}
              </EmergencyButton>
              <EmergencyButton
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={handleBack}
                disabled={registerSite.isPending}
              >
                Revisar
              </EmergencyButton>
            </div>
          </StepPane>
        )}
      </AnimatePresence>
    </WizardShell>
  )
}

// ── Subcomponentes internos ──────────────────────────────────────────────────

function WizardShell({
  onClose,
  step,
  title,
  children,
}: {
  onClose: () => void
  step: WizardStep
  title: string
  children: React.ReactNode
}) {
  const steps: WizardStep[] = [1, 2, 3, 4]
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-0 z-[60] flex flex-col bg-base-900/95 backdrop-blur-2xl lg:rounded-2xl"
    >
      {/* Header */}
      <div className="flex flex-col items-center px-5 pt-safe">
        <EmergencyButton
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar"
          className="mt-2"
        >
          <ChevronDown className="h-6 w-6" />
        </EmergencyButton>
        <div className="w-full px-1 pb-3">
          <p className="text-sm text-ink-muted">Registrar nuevo centro</p>
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {title}
          </h1>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pb-3">
        {steps.map((s) => (
          <div
            key={s}
            className={cn(
              'rounded-full transition-all duration-300',
              s === step ? 'h-2 w-6 bg-info' : s < step ? 'h-2 w-2 bg-info/50' : 'h-2 w-2 bg-white/20',
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-32">{children}</div>
    </motion.div>
  )
}

function StepPane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  )
}

function NavRow({
  onBack,
  onNext,
  backLabel = 'Atrás',
  nextLabel = 'Siguiente',
  nextDisabled = false,
}: {
  onBack: () => void
  onNext: () => void
  backLabel?: string
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <EmergencyButton variant="ghost" size="lg" onClick={onBack}>
        {backLabel}
      </EmergencyButton>
      <EmergencyButton
        variant="primary"
        size="lg"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center justify-center gap-2"
      >
        {nextLabel}
        <ChevronRight className="h-4 w-4" />
      </EmergencyButton>
    </div>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-ink">{value}</span>
    </div>
  )
}
