import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  MapPin,
  Package,
  Route,
  Send,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import { FaroIcon } from '@/components/brand/faro-icon'
import { ContextualHelpCard } from '@/components/onboarding/ContextualHelpCard'
import { GuidedEmptyState } from '@/components/onboarding/GuidedEmptyState'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useSubmitReport } from '@/hooks/useFaroMutations'
import { cn } from '@/lib/utils'
import { SITE_META } from '@/lib/status-config'
import { siteToNeedableType } from '@/lib/site-utils'
import { useFaro } from '@/store/faro-context'
import type { Site, SiteType, Center } from '@/lib/types'
import type { RegisterSiteType } from '@/repositories/types'
import { InvisibleTurnstile, type InvisibleTurnstileHandle } from '@/components/security/invisible-turnstile'

type ReportCategory = 'insumos' | 'seguridad' | 'vialidad' | 'otra'
type SiteTypeFilter = 'all' | RegisterSiteType

const CATEGORIES: Array<{
  id: ReportCategory
  label: string
  hint: string
  icon: typeof Package
  tone: string
  border: string
  bg: string
}> = [
  {
    id: 'insumos',
    label: 'Insumos',
    hint: 'Faltantes o necesidades',
    icon: Package,
    tone: 'text-critical',
    border: 'border-critical/40',
    bg: 'bg-critical/10',
  },
  {
    id: 'seguridad',
    label: 'Seguridad',
    hint: 'Riesgos o emergencias',
    icon: Shield,
    tone: 'text-warning',
    border: 'border-warning/40',
    bg: 'bg-warning/10',
  },
  {
    id: 'vialidad',
    label: 'Vialidad',
    hint: 'Calles, accesos, rutas',
    icon: Route,
    tone: 'text-info',
    border: 'border-info/40',
    bg: 'bg-info/10',
  },
  {
    id: 'otra',
    label: 'Otra información',
    hint: 'General o informativa',
    icon: Sparkles,
    tone: 'text-purple-300',
    border: 'border-purple-400/35',
    bg: 'bg-purple-500/10',
  },
]

const TYPE_FILTERS: Array<{ id: SiteTypeFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'hospital', label: 'Hospitales' },
  { id: 'shelter', label: 'Refugios' },
  { id: 'supply_center', label: 'Acopio' },
]

const MAX_DETAILS = 250

function siteMatchesTypeFilter(site: Site, filter: SiteTypeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'hospital') return site.type === 'hospital' || site.type === 'medical_center'
  if (filter === 'shelter') return site.type === 'shelter'
  return site.type === 'supply_center'
}

function siteTypeLabel(type: SiteType): string {
  return SITE_META[type]?.label ?? 'Centro'
}

/**
 * Reporte ciudadano — solo sobre centros registrados en FARO.
 */
export function ReportsScreen() {
  const { sites, state } = useFaro()
  const submitReport = useSubmitReport()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SiteTypeFilter>('all')
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [details, setDetails] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const turnstileRef = useRef<InvisibleTurnstileHandle>(null)

  const registeredSites = useMemo(
    () =>
      [...sites]
        .filter((site) => site.type !== 'organization')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase()
    return registeredSites.filter((site) => {
      if (!siteMatchesTypeFilter(site, typeFilter)) return false
      if (!q) return true
      const center = state.centers.find((c) => c.id === site.id)
      const address = center?.location.address?.toLowerCase() ?? ''
      return (
        site.name.toLowerCase().includes(q) ||
        site.zone.toLowerCase().includes(q) ||
        address.includes(q) ||
        siteTypeLabel(site.type).toLowerCase().includes(q)
      )
    })
  }, [registeredSites, search, typeFilter, state.centers])

  const selectedCenter = selectedSite
    ? state.centers.find((c) => c.id === selectedSite.id)
    : undefined

  const canSubmit =
    !!selectedSite &&
    !!category &&
    details.trim().length >= 8 &&
    !submitReport.isPending

  const resetForm = () => {
    setSearch('')
    setTypeFilter('all')
    setSelectedSite(null)
    setCategory(null)
    setDetails('')
    setSubmitError(null)
    setSent(false)
  }

  const handleSubmit = async () => {
    if (!canSubmit || !category || !selectedSite) return
    setSubmitError(null)

    const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? category
    const description = `Categoría: ${categoryLabel}. ${details.trim()}`

    try {
      if (import.meta.env.VITE_TURNSTILE_SITE_KEY) {
        const token = await turnstileRef.current?.requestToken()
        if (!token) {
          setSubmitError('No pudimos verificar la seguridad del reporte. Inténtalo nuevamente.')
          return
        }
      }
      await submitReport.mutateAsync({
        description,
        siteType: siteToNeedableType(selectedSite),
        siteId: selectedSite.id,
        siteLabel: selectedSite.name,
        latitude: selectedSite.lat,
        longitude: selectedSite.lng,
        contactInfo: 'Reporte ciudadano',
      })
      setSent(true)
    } catch {
      setSubmitError('No se pudo enviar el reporte. Inténtalo nuevamente.')
    }
  }

  return (
    <ScreenScaffold title="Reporte ciudadano" subtitle="Ayuda a tu comunidad">
      <div className="space-y-5 pb-6 pt-2">
        <ContextualHelpCard moduleId="reports" />
        <GlassCard className="flex items-start gap-3 border border-purple-400/20 bg-purple-500/[0.08]">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-200">
            <Heart className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">Tu reporte ayuda a salvar vidas</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Solo puedes reportar sobre hospitales, refugios o centros de acopio ya registrados
              en FARO. Así verificamos la información con el coordinador del lugar.
            </p>
          </div>
        </GlassCard>

        {sent ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            <GlassCard className="space-y-3">
              <div className="flex items-center gap-2 text-operational">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-base font-semibold">Reporte enviado</p>
              </div>
              <p className="text-sm text-ink-muted">
                Gracias por ayudar a tu comunidad. Tu reporte sobre{' '}
                <span className="font-medium text-ink">{selectedSite?.name}</span> quedará en
                revisión de verificación.
              </p>
              <EmergencyButton variant="primary" size="lg" className="w-full" onClick={resetForm}>
                Enviar otro reporte
              </EmergencyButton>
            </GlassCard>
          </motion.div>
        ) : (
          <>
            {/* Paso 1 — Centro registrado */}
            <section className="space-y-2.5">
              <StepLabel step={1} title="¿Sobre qué lugar es el reporte?" />
              <p className="px-0.5 text-xs text-ink-subtle">
                Selecciona un centro registrado. Si el lugar no aparece, un coordinador debe
                registrarlo primero.
              </p>

              {registeredSites.length === 0 ? (
                <GuidedEmptyState
                  icon={MapPin}
                  title="Aún no hay centros registrados"
                  description="Los reportes ciudadanos se vinculan a centros activos en FARO. Cuando existan hospitales, refugios o acopios, podrás reportar sobre ellos."
                  hint="Si conoces un centro que debería estar aquí, contacta a un coordinador o administrador."
                />
              ) : selectedSite ? (
                <SelectedLocationChip
                  site={selectedSite}
                  typeLabel={siteTypeLabel(selectedSite.type)}
                  address={selectedCenter?.location.address}
                  onClear={() => {
                    setSelectedSite(null)
                    setSearch('')
                    setTypeFilter('all')
                  }}
                />
              ) : (
                <RegisteredCenterPicker
                  search={search}
                  typeFilter={typeFilter}
                  filteredSites={filteredSites}
                  centers={state.centers}
                  onSearchChange={setSearch}
                  onTypeFilterChange={setTypeFilter}
                  onSelect={(site) => {
                    setSelectedSite(site)
                    setSearch('')
                    setTypeFilter('all')
                  }}
                />
              )}
            </section>

            {/* Paso 2 — Categoría */}
            <section className="space-y-2.5">
              <StepLabel step={2} title="Categoría del reporte" />
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((item) => {
                  const Icon = item.icon
                  const active = category === item.id
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCategory(item.id)}
                      className={cn(
                        'min-h-[92px] rounded-2xl border px-3 py-3 text-left transition-colors',
                        active
                          ? cn(item.border, item.bg, 'ring-1 ring-white/10')
                          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 items-center justify-center rounded-xl',
                          active ? item.bg : 'bg-white/[0.06]',
                          item.tone,
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <p className="mt-2 text-sm font-semibold text-ink">{item.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-subtle">{item.hint}</p>
                    </motion.button>
                  )
                })}
              </div>
            </section>

            {/* Paso 3 — Detalles */}
            <section className="space-y-2.5">
              <StepLabel step={3} title="Cuéntanos los detalles" />
              <GlassCard inset={false} className="space-y-2 p-0">
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
                  rows={5}
                  placeholder="Describe brevemente lo que sabes..."
                  className="min-h-[132px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-info/50"
                />
                <p className="px-1 text-right text-xs text-ink-faint">
                  {details.length}/{MAX_DETAILS}
                </p>
              </GlassCard>
            </section>

            {submitError && (
              <p className="flex items-center gap-2 text-sm text-critical">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {submitError}
              </p>
            )}

            {!selectedSite && registeredSites.length > 0 && (
              <p className="text-center text-xs text-ink-subtle">
                Selecciona un centro registrado para continuar
              </p>
            )}

            <EmergencyButton
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitReport.isPending ? (
                'Enviando…'
              ) : (
                <>
                  <Send className="h-4 w-4" /> Enviar reporte
                </>
              )}
            </EmergencyButton>

            <p className="text-center text-xs text-ink-subtle">
              Gracias por ayudar a tu comunidad 💙
            </p>
          </>
        )}
      </div>
      <InvisibleTurnstile ref={turnstileRef} action="citizen-report" />
    </ScreenScaffold>
  )
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-info/20 text-xs font-semibold text-info">
        {step}
      </span>
      <p className="text-[15px] font-medium text-ink">{title}</p>
    </div>
  )
}

function RegisteredCenterPicker({
  search,
  typeFilter,
  filteredSites,
  centers,
  onSearchChange,
  onTypeFilterChange,
  onSelect,
}: {
  search: string
  typeFilter: SiteTypeFilter
  filteredSites: Site[]
  centers: Center[]
  onSearchChange: (value: string) => void
  onTypeFilterChange: (value: SiteTypeFilter) => void
  onSelect: (site: Site) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <FaroIcon size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="report-center-listbox"
          aria-autocomplete="list"
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Toca para buscar un centro registrado…"
          className={cn(
            'h-12 w-full rounded-2xl border bg-white/[0.04] pl-10 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint',
            open ? 'border-info/50 ring-1 ring-info/20' : 'border-white/10 focus:border-info/50',
          )}
        />
      </div>

      {open && (
        <div
          id="report-center-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-base-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onTypeFilterChange(filter.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    typeFilter === filter.id
                      ? 'border-info/50 bg-info/15 text-ink'
                      : 'border-white/10 bg-white/[0.04] text-ink-subtle hover:bg-white/[0.08]',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              {filteredSites.length} centro{filteredSites.length === 1 ? '' : 's'} · desplázate en la lista
            </p>
          </div>

          <ul className="max-h-[min(280px,45vh)] space-y-1 overflow-y-auto overscroll-contain p-2">
            {filteredSites.length === 0 ? (
              <li className="rounded-xl px-3 py-4 text-center text-sm text-ink-muted">
                No encontramos ese centro. Prueba otro nombre o filtro.
              </li>
            ) : (
              filteredSites.map((site) => {
                const center = centers.find((c) => c.id === site.id)
                const subtitle = center?.location.address ?? site.zone
                return (
                  <li key={site.id} role="option">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(site)
                        setOpen(false)
                      }}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-info/25 hover:bg-white/[0.08]"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{site.name}</span>
                          <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">
                            {siteTypeLabel(site.type)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-subtle">{subtitle}</span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function SelectedLocationChip({
  site,
  typeLabel,
  address,
  onClear,
}: {
  site: Site
  typeLabel: string
  address?: string
  onClear: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-info/30 bg-info/10 px-3 py-2.5">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">
            {site.name}, {site.zone}
          </p>
          <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-info">
            {typeLabel}
          </span>
        </div>
        {address ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-subtle">{address}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-1 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
        aria-label="Cambiar centro"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
