import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, MapPin, Send } from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { EmergencyBadge } from '@/components/faro/emergency-badge'
import { WizardProgress } from '@/components/ui/wizard-progress'
import { useFaro } from '@/store/faro-context'
import { SITE_META } from '@/lib/status-config'
import { timeAgo } from '@/lib/utils'
import type { Site } from '@/lib/types'

export interface CoordinatorWizardData {
  fullName: string
  email: string
  phone: string
  roleTitle: string
  organization: string
  selectedSiteId: string
  reason: string
  experience: string
}

interface CoordinatorRequestWizardProps {
  initialData: Partial<CoordinatorWizardData>
  onSubmit: (data: CoordinatorWizardData) => Promise<void>
  submitting?: boolean
  error?: string | null
}

const STEPS = 3

export function CoordinatorRequestWizard({
  initialData,
  onSubmit,
  submitting,
  error,
}: CoordinatorRequestWizardProps) {
  const { sites } = useFaro()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState(initialData.fullName ?? '')
  const [email, setEmail] = useState(initialData.email ?? '')
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [roleTitle, setRoleTitle] = useState(initialData.roleTitle ?? '')
  const [organization, setOrganization] = useState(initialData.organization ?? '')
  const [selectedSiteId, setSelectedSiteId] = useState(initialData.selectedSiteId ?? '')
  const [reason, setReason] = useState(initialData.reason ?? '')
  const [experience, setExperience] = useState(initialData.experience ?? '')
  const [search, setSearch] = useState('')

  const registeredSites = useMemo(
    () => sites.filter((s) => s.type !== 'organization').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return registeredSites
    return registeredSites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.zone.toLowerCase().includes(q) ||
        (SITE_META[s.type]?.label ?? '').toLowerCase().includes(q),
    )
  }, [registeredSites, search])

  const selectedSite = registeredSites.find((s) => s.id === selectedSiteId)

  const step1Valid = fullName.trim() && email.trim()
  const step2Valid = Boolean(selectedSiteId)
  const step3Valid = reason.trim().length >= 10

  async function handleSend() {
    await onSubmit({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      roleTitle: roleTitle.trim(),
      organization: organization.trim(),
      selectedSiteId,
      reason: reason.trim(),
      experience: experience.trim(),
    })
  }

  return (
    <div className="space-y-5">
      <WizardProgress step={step} total={STEPS} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {step === 1 && (
            <GlassCard className="space-y-3">
              <div>
                <p className="text-[15px] font-semibold text-ink">Información personal</p>
                <p className="text-sm text-ink-subtle">Cuéntanos quién eres y cómo contactarte.</p>
              </div>
              <Field label="Nombre" value={fullName} onChange={setFullName} />
              <Field label="Correo" value={email} onChange={setEmail} type="email" />
              <Field label="Teléfono" value={phone} onChange={setPhone} />
              <Field label="Cargo" value={roleTitle} onChange={setRoleTitle} />
              <Field label="Organización" value={organization} onChange={setOrganization} />
            </GlassCard>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <GlassCard className="space-y-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">Centro a administrar</p>
                  <p className="text-sm text-ink-subtle">Busca y selecciona el centro que deseas coordinar.</p>
                </div>
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <FaroIcon size={20} className="shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, zona o tipo…"
                    className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                  />
                </label>
              </GlassCard>

              {selectedSite && (
                <CenterPreviewCard
                  site={selectedSite}
                  selected
                  onSelect={() => setSelectedSiteId('')}
                />
              )}

              {!selectedSite && (
                <div className="max-h-[42vh] space-y-2 overflow-y-auto">
                  {filteredSites.length === 0 ? (
                    <GlassCard className="text-sm text-ink-muted">No se encontraron centros.</GlassCard>
                  ) : (
                    filteredSites.slice(0, 12).map((site) => (
                      <CenterPreviewCard
                        key={site.id}
                        site={site}
                        onSelect={() => setSelectedSiteId(site.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <GlassCard className="space-y-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">Validación</p>
                  <p className="text-sm text-ink-subtle">Ayuda al administrador a entender tu solicitud.</p>
                </div>
                <TextArea
                  label="¿Por qué deseas administrar este centro?"
                  value={reason}
                  onChange={setReason}
                  rows={3}
                />
                <TextArea label="Experiencia" value={experience} onChange={setExperience} rows={2} />
              </GlassCard>

              <GlassCard className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Resumen</p>
                <SummaryRow label="Solicitante" value={fullName} />
                <SummaryRow label="Correo" value={email} />
                {organization && <SummaryRow label="Organización" value={organization} />}
                {selectedSite && (
                  <SummaryRow
                    label="Centro"
                    value={`${selectedSite.name} · ${selectedSite.zone}`}
                  />
                )}
              </GlassCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {step > 1 && (
          <EmergencyButton variant="glass" size="lg" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> Atrás
          </EmergencyButton>
        )}
        {step < STEPS ? (
          <EmergencyButton
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </EmergencyButton>
        ) : (
          <EmergencyButton
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!step3Valid || submitting}
            onClick={() => void handleSend()}
          >
            <Send className="h-4 w-4" /> Enviar solicitud
          </EmergencyButton>
        )}
      </div>
    </div>
  )
}

export function CoordinatorRequestSuccess() {
  return (
    <GlassCard className="space-y-4 pt-2 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-operational/15 ring-1 ring-operational/25">
        <CheckCircle2 className="h-7 w-7 text-operational" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-ink">Solicitud enviada</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Un administrador regional revisará tu solicitud. No podrás modificar información hasta que
          aprueben tu acceso como coordinador.
        </p>
      </div>
    </GlassCard>
  )
}

function CenterPreviewCard({
  site,
  selected,
  onSelect,
}: {
  site: Site
  selected?: boolean
  onSelect: () => void
}) {
  const emoji = site.type === 'hospital' ? '🏥' : site.type === 'shelter' ? '🏠' : '📦'
  return (
    <GlassCard
      className={`space-y-3 transition-colors ${selected ? 'ring-2 ring-info/40' : 'hover:bg-white/[0.06]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg leading-none">{emoji}</p>
          <p className="mt-2 text-[17px] font-semibold text-ink">{site.name}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-subtle">
            <MapPin className="h-3.5 w-3.5" /> {site.zone}
          </p>
        </div>
        <EmergencyBadge status={site.status} />
      </div>
      <div className="flex items-center justify-between text-xs text-ink-subtle">
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          {SITE_META[site.type]?.label ?? 'Centro'}
        </span>
        <span>Actualizado {timeAgo(site.updatedAt)}</span>
      </div>
      <EmergencyButton variant={selected ? 'glass' : 'primary'} size="md" className="w-full" onClick={onSelect}>
        {selected ? 'Cambiar centro' : 'Seleccionar este centro'}
      </EmergencyButton>
    </GlassCard>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-info/40"
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-info/40"
      />
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  )
}
