import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, ChevronRight, Copy, SearchCheck } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { GlassCard } from '@/components/ui/glass-card'
import { reportRepository } from '@/repositories/report-repository'
import { cn } from '@/lib/utils'
import {
  ReportContactSheet,
  type ReportContactData,
} from '@/components/portal/report-contact-sheet'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Recibido',
  under_review: 'En revisión',
  verified: 'Asignado a un centro',
  dismissed: 'Cerrado',
}


type ReportStep = 'start' | 'category' | 'location' | 'description' | 'photo' | 'confirmation' | 'lookup'

interface CitizenReportProps {
  onDone: () => void
}

const REPORT_CATEGORIES = [
  { id: 'need', label: 'Necesidad', emoji: '📦', description: 'Falta de agua, alimentos, medicinas' },
  { id: 'damage', label: 'Daño', emoji: '🏚️', description: 'Vivienda o infraestructura dañada' },
  { id: 'center', label: 'Centro', emoji: '🏥', description: 'Problema en hospital o refugio' },
  { id: 'person', label: 'Persona', emoji: '👤', description: 'Alguien necesita ayuda' },
  { id: 'infra', label: 'Infraestructura', emoji: '💡', description: 'Vialidad, electricidad, agua' },
  { id: 'other', label: 'Otro', emoji: '📝', description: 'Cualquier otra situación' },
] as const

export function CitizenReport({ onDone }: CitizenReportProps) {
  const [step, setStep] = useState<ReportStep>('start')
  const [contactData, setContactData] = useState<ReportContactData | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState<{ trackingCode: string } | null>(null)
  const [lookupCode, setLookupCode] = useState('')
  const [lookupResult, setLookupResult] = useState<{ code: string; status: string; description: string } | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (contactData && step === 'start') setStep('category')
  }, [contactData, step])

  const handleSubmit = async () => {
    if (!contactData || description.trim().length < 8) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { trackingCode } = await reportRepository.createPublic({
        description,
        contactName: contactData.name,
        contactPhone: contactData.phone,
        contactEmail: contactData.email,
        location,
        category: category ?? undefined,
      })
      setSubmitted({ trackingCode })
      setStep('confirmation')
    } catch {
      setSubmitError('Error al enviar el reporte. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLookup = async () => {
    setLookupError(null)
    setLookupLoading(true)
    try {
      const report = await reportRepository.findByTrackingCode(lookupCode)
      if (!report) {
        setLookupError('No encontramos ese código. Revisa e intenta de nuevo.')
        return
      }
      setLookupResult({
        code: lookupCode,
        status: STATUS_LABELS[report.status] ?? report.status,
        description: report.description,
      })
    } catch {
      setLookupError('Error al consultar. Intenta de nuevo.')
    } finally {
      setLookupLoading(false)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const resetAll = () => {
    setStep('start')
    setCategory(null)
    setLocation('')
    setDescription('')
    setSubmitted(null)
    setContactData(null)
    onDone()
  }

  if (step === 'lookup') {
    return (
      <div className="space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
        <button type="button" onClick={() => setStep(submitted ? 'confirmation' : 'start')} className="flex items-center gap-1 text-sm font-medium text-info">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Volver
        </button>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink">Consultar estado</h2>
          <p className="text-sm text-ink-subtle">Ingresa tu código de seguimiento. No necesitas cuenta.</p>
        </div>
        <input
          value={lookupCode}
          onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
          placeholder="FARO-2026-XXXX"
          className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 font-mono text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
        />
        <EmergencyButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={lookupCode.trim().length < 8 || lookupLoading}
          onClick={handleLookup}
        >
          <SearchCheck className="h-5 w-5" />
          {lookupLoading ? 'Consultando...' : 'Consultar'}
        </EmergencyButton>
        {lookupError && <p className="text-sm text-critical">{lookupError}</p>}
        {lookupResult && (
          <div className={cn('rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3')}>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Estado actual</p>
            <p className="mt-1 text-base font-semibold text-info">{lookupResult.status}</p>
            <p className="mt-2 line-clamp-2 text-xs text-ink-subtle">{lookupResult.description}</p>
          </div>
        )}
      </div>
    )
  }

  if (step === 'confirmation' && submitted) {
    return (
      <div className="space-y-5 px-4 pt-4 lg:px-8 lg:pt-6">
        <GlassCard className="!rounded-2xl !border-white/[0.06] !p-6 !shadow-none">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-ink">Tu reporte fue enviado</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
              Un gestor de casos revisará tu reporte pronto. Guarda este código para consultar el estado más adelante.
            </p>
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">Código de seguimiento</p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-wide text-info sm:text-3xl">{submitted.trackingCode}</p>
                <EmergencyButton
                  variant="glass"
                  size="sm"
                  className="mt-3"
                  onClick={() => void copyCode(submitted.trackingCode)}
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copiado' : 'Copiar código'}
                </EmergencyButton>
              </div>
          </div>
        </GlassCard>

        <EmergencyButton variant="primary" size="lg" className="w-full" onClick={() => {
          setLookupCode(submitted.trackingCode)
          setLookupError(null)
          setStep('lookup')
        }}>
          <SearchCheck className="h-5 w-5" />
          Consultar estado de mi reporte
        </EmergencyButton>

        <EmergencyButton variant="glass" size="md" className="w-full" onClick={resetAll}>
          Volver al inicio
        </EmergencyButton>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-4 pt-4 lg:px-8 lg:pt-6">
      {/* Step indicator */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => {
          const currentStepIdx = step === 'start' ? 0 : step === 'category' ? 1 : step === 'location' ? 2 : step === 'description' ? 3 : step === 'photo' ? 4 : 5
          return (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                s <= currentStepIdx ? 'bg-info' : 'bg-white/[0.08]',
              )}
            />
          )
        })}
      </div>

      <h2 className="text-xl font-semibold text-ink">Reportar una situación</h2>

      {step === 'start' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-subtle">
            Cuéntanos qué está pasando. Solo pediremos un teléfono o correo para este reporte — sin crear cuenta.
          </p>
          <EmergencyButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              if (contactData) setStep('category')
              else setContactOpen(true)
            }}
          >
            Empezar reporte
          </EmergencyButton>
          <button
            type="button"
            onClick={() => {
              setLookupCode('')
              setLookupResult(null)
              setLookupError(null)
              setStep('lookup')
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm font-medium text-info transition-colors hover:bg-white/[0.06]"
          >
            <SearchCheck className="h-4 w-4" />
            Ya tengo un código — consultar estado
          </button>
          <GlassCard className="!rounded-2xl !border-warning/20 !bg-warning/[0.04] !p-3 !shadow-none">
            <p className="text-xs text-warning">
              Si hay riesgo de vida, llama al <span className="font-semibold">911</span> o a Protección Civil antes de usar FARO.
            </p>
          </GlassCard>
        </div>
      )}

      {step === 'category' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-subtle">¿Qué deseas reportar?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setCategory(cat.id); setStep('location') }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                  category === cat.id
                    ? 'border-info/50 bg-info/10'
                    : 'border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]',
                )}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span>
                  <span className="block text-sm font-medium text-ink">{cat.label}</span>
                  <span className="text-xs text-ink-subtle">{cat.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'location' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-subtle">¿Dónde ocurre?</p>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej: Macuto, La Guaira — cerca de la plaza"
            className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
          />
          <div className="flex gap-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('category')}>
              Atrás
            </EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={location.trim().length < 3}
              onClick={() => setStep('description')}
            >
              Continuar
            </EmergencyButton>
          </div>
        </div>
      )}

      {step === 'description' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-subtle">Describe la situación con el mayor detalle posible</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Ej: Casa inundada, adulto mayor necesita medicamentos y no puede salir..."
            className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
          />
          <div className="flex gap-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('location')}>
              Atrás
            </EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={description.trim().length < 8}
              onClick={() => setStep('photo')}
            >
              Continuar
            </EmergencyButton>
          </div>
        </div>
      )}

      {step === 'photo' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-subtle">¿Tienes una foto? (opcional)</p>
          <button
            type="button"
            className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-8 text-center transition-colors hover:border-info/40"
          >
            <Camera className="h-8 w-8 text-ink-muted" />
            <span className="text-sm font-medium text-ink-subtle">Tomar foto o subir imagen</span>
            <span className="text-xs text-ink-muted">Recomendado pero no obligatorio</span>
          </button>
          {submitError && <p className="text-sm text-critical">{submitError}</p>}
          <div className="flex gap-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('description')}>
              Atrás
            </EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Enviando...' : 'Enviar reporte'}
            </EmergencyButton>
          </div>
          <p className="text-xs text-ink-muted">
            Al enviar, recibirás un código de seguimiento. Guárdalo para consultar el estado después.
          </p>
        </div>
      )}

      <ReportContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onContinue={(contact) => {
          setContactData(contact)
          setContactOpen(false)
          setStep('category')
        }}
      />
    </div>
  )
}


