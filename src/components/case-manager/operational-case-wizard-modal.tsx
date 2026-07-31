import { useEffect, useMemo, useState } from 'react'
import { X, ChevronRight, MapPin, Package, Users, ShieldAlert } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { useReportAnalysis } from '@/hooks/useCaseManager'
import { useCreateOperationalCaseFromWizard } from '@/hooks/useOperationalWizard'
import { cn, isValidCoord } from '@/lib/utils'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { getResourceLabel, getResourceMinRecommended, getResourceUnit, resolveCatalogKey } from '@/lib/resource-catalog'
import { recommendCenters } from '@/services/logistics-service'
import type { CasePriority } from '@/domain/case-lifecycle.types'
import type { WizardDispatchAnswer, WizardOperationKind, WizardStrategy } from '@/services/operational-wizard-service'
import { opsChannelLog } from '@/lib/operational-log'

type WizardStep = 'op' | 'need' | 'people' | 'inventory' | 'decision' | 'confirm'

const OP_KINDS: Array<{ id: WizardOperationKind; label: string; hint: string; priority: CasePriority }> = [
  { id: 'critical_immediate', label: 'Crítica inmediata', hint: 'Respuesta inmediata, alto riesgo.', priority: 'critical' },
  { id: 'high_priority', label: 'Alta prioridad', hint: 'Caso urgente, gestión prioritaria.', priority: 'high' },
  { id: 'citizen_coverage', label: 'Cobertura ciudadana', hint: 'Convocatoria pública con reservas.', priority: 'medium' },
  { id: 'follow_up', label: 'Seguimiento', hint: 'Monitoreo / post-evento.', priority: 'low' },
]

const PRIORITIES: Array<{ id: CasePriority; label: string; tone: string }> = [
  { id: 'critical', label: 'Crítica', tone: 'bg-critical/20 text-critical' },
  { id: 'high', label: 'Alta', tone: 'bg-warning/20 text-warning' },
  { id: 'medium', label: 'Media', tone: 'bg-info/20 text-info' },
  { id: 'low', label: 'Baja', tone: 'bg-white/10 text-ink-subtle' },
]

type NeedCategoryId =
  | 'agua'
  | 'alimentos'
  | 'medicamentos'
  | 'higiene'
  | 'bebes'
  | 'refugio'
  | 'herramientas'
  | 'transporte'
  | 'rescate'
  | 'otro'

const NEED_CATEGORIES: Array<{ id: NeedCategoryId; label: string; keys: string[] }> = [
  { id: 'agua', label: 'Agua', keys: ['agua'] },
  { id: 'alimentos', label: 'Alimentos', keys: ['harina', 'arroz', 'aceite', 'pasta', 'leche', 'alimentos'] },
  { id: 'medicamentos', label: 'Medicamentos', keys: ['medicamentos', 'paracetamol', 'ibuprofeno', 'insulina', 'loratadina', 'suero'] },
  { id: 'higiene', label: 'Higiene', keys: ['guantes', 'gasas'] },
  { id: 'bebes', label: 'Bebés', keys: ['panales', 'leche_infantil'] },
  { id: 'refugio', label: 'Refugio', keys: ['colchones', 'cobijas', 'beds'] },
  { id: 'herramientas', label: 'Herramientas', keys: ['palas', 'picos', 'martillos', 'herramientas'] },
  { id: 'transporte', label: 'Transporte', keys: ['baterias', 'linternas'] },
  { id: 'rescate', label: 'Rescate', keys: ['herramientas'] },
  { id: 'otro', label: 'Otro', keys: [] },
]

const AFFECTED_QUICK = [1, 5, 10, 25, 50, 100] as const
const COVERAGE_DURATIONS: Array<{ hours: 6 | 12 | 24; label: string }> = [
  { hours: 6, label: '6 horas' },
  { hours: 12, label: '12 horas' },
  { hours: 24, label: '24 horas' },
]

export function OperationalCaseWizardModal({
  open,
  reportId,
  actorId,
  onClose,
  onDone,
}: {
  open: boolean
  reportId: string | null
  actorId?: string
  onClose: () => void
  onDone: (result: { caseId: string }) => void
}) {
  const { data: analysis, isLoading } = useReportAnalysis(open ? reportId : null)
  const createCase = useCreateOperationalCaseFromWizard()

  const report = analysis?.report
  const reportHasGps = Boolean(
    report && isValidCoord(report.location.coordinates.lat, report.location.coordinates.lng),
  )

  const [step, setStep] = useState<WizardStep>('op')
  const [opKind, setOpKind] = useState<WizardOperationKind>('high_priority')
  const [priority, setPriority] = useState<CasePriority>('high')

  const [needCategory, setNeedCategory] = useState<NeedCategoryId>('agua')
  const [needKey, setNeedKey] = useState<string>('agua')
  const [needOtherText, setNeedOtherText] = useState<string>('')

  const [peopleAffected, setPeopleAffected] = useState<number>(5)
  const [requiredQuantity, setRequiredQuantity] = useState<number>(10)

  const [coverageDuration, setCoverageDuration] = useState<6 | 12 | 24>(12)

  const [resolvedPlace, setResolvedPlace] = useState<ResolvedPlace | null>(null)

  const [dispatchAnswer, setDispatchAnswer] = useState<WizardDispatchAnswer>('unknown')
  const [openVolunteerCallIfNo, setOpenVolunteerCallIfNo] = useState<boolean>(true)
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null)
  const [manualOpenCall, setManualOpenCall] = useState<boolean>(false)

  const hasGps = reportHasGps || Boolean(resolvedPlace && isValidCoord(resolvedPlace.lat, resolvedPlace.lng))

  useEffect(() => {
    if (!open) return
    setStep('op')
    setOpKind('high_priority')
    setPriority('high')
    setNeedCategory('agua')
    setNeedKey('agua')
    setNeedOtherText('')
    setPeopleAffected(5)
    setRequiredQuantity(10)
    setCoverageDuration(12)
    setResolvedPlace(null)
    setDispatchAnswer('unknown')
    setOpenVolunteerCallIfNo(true)
    setSelectedCenterId(null)
    setManualOpenCall(false)
  }, [open, reportId])

  useEffect(() => {
    const pref = OP_KINDS.find((k) => k.id === opKind)?.priority ?? 'medium'
    setPriority((prev) => {
      if (prev === 'critical' || prev === 'high' || prev === 'medium' || prev === 'low') return prev
      return pref
    })
  }, [opKind])

  const needKeyOrText = useMemo(() => {
    if (needCategory === 'otro') return needOtherText.trim()
    return needKey
  }, [needCategory, needKey, needOtherText])

  const resolvedResourceType = useMemo(() => resolveCatalogKey(needKeyOrText) ?? null, [needKeyOrText])
  const unit = useMemo(() => (resolvedResourceType ? getResourceUnit(resolvedResourceType) : 'unidades'), [resolvedResourceType])
  const needLabel = useMemo(() => (resolvedResourceType ? getResourceLabel(resolvedResourceType) : (needKeyOrText || 'Otro')), [resolvedResourceType, needKeyOrText])

  useEffect(() => {
    // Default qty: mínimo recomendado o personas afectadas.
    const min = resolvedResourceType ? getResourceMinRecommended(resolvedResourceType) : 10
    setRequiredQuantity((prev) => {
      const base = Math.max(1, Math.max(peopleAffected, min))
      return prev > 0 ? prev : base
    })
  }, [resolvedResourceType, peopleAffected])

  const wizardSteps: WizardStep[] = useMemo(() => ['op', 'need', 'people', 'inventory', 'decision', 'confirm'], [])

  const coords = useMemo(() => {
    if (reportHasGps && report) {
      return { lat: report.location.coordinates.lat, lng: report.location.coordinates.lng }
    }
    if (resolvedPlace && isValidCoord(resolvedPlace.lat, resolvedPlace.lng)) {
      return { lat: resolvedPlace.lat, lng: resolvedPlace.lng }
    }
    return null
  }, [report, reportHasGps, resolvedPlace])

  const [centerResults, setCenterResults] = useState<Array<Awaited<ReturnType<typeof recommendCenters>>[number]>>([])
  const [centersLoading, setCentersLoading] = useState(false)
  const [centersError, setCentersError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (step !== 'inventory' && step !== 'decision' && step !== 'confirm') return
    if (!coords) return
    if (!resolvedResourceType) {
      setCenterResults([])
      return
    }
    let cancelled = false
    setCentersLoading(true)
    setCentersError(null)
    void recommendCenters({
      resourceType: resolvedResourceType,
      minQty: 1,
      missionLat: coords.lat,
      missionLng: coords.lng,
      limit: 8,
    })
      .then((rows) => {
        if (cancelled) return
        setCenterResults(rows)
        if (!selectedCenterId && rows[0]) setSelectedCenterId(rows[0].centerId)
      })
      .catch((err) => {
        if (cancelled) return
        setCentersError(err instanceof Error ? err.message : 'No se pudo consultar inventarios')
        setCenterResults([])
      })
      .finally(() => {
        if (cancelled) return
        setCentersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, step, coords, resolvedResourceType, selectedCenterId])

  const compatibleCenters = centerResults

  const strategy: WizardStrategy = useMemo(() => {
    if (opKind === 'citizen_coverage') return { mode: 'open_volunteer_call' }
    if (compatibleCenters.length > 0 && selectedCenterId) {
      return {
        mode: 'center_first',
        centerId: selectedCenterId,
        dispatchAnswer,
        openVolunteerCallIfNo,
      }
    }
    if (manualOpenCall) return { mode: 'open_volunteer_call' }
    return { mode: 'manual_review' }
  }, [opKind, compatibleCenters.length, selectedCenterId, dispatchAnswer, openVolunteerCallIfNo, manualOpenCall])

  const canContinue = useMemo(() => {
    if (step === 'op') return true
    if (step === 'need') {
      if (needCategory === 'otro') return Boolean(needOtherText.trim())
      return Boolean(needKey)
    }
    if (step === 'people') {
      if (opKind === 'citizen_coverage') return requiredQuantity > 0 && [6, 12, 24].includes(coverageDuration)
      return peopleAffected > 0 && requiredQuantity > 0
    }
    if (step === 'inventory') return hasGps
    if (step === 'decision') return true
    if (step === 'confirm') return hasGps
    return true
  }, [step, needCategory, needOtherText, needKey, opKind, peopleAffected, requiredQuantity, coverageDuration, hasGps])

  const goNext = () => {
    const idx = wizardSteps.indexOf(step)
    const next = wizardSteps[Math.min(wizardSteps.length - 1, idx + 1)]
    setStep(next)
  }
  const goBack = () => {
    const idx = wizardSteps.indexOf(step)
    const prev = wizardSteps[Math.max(0, idx - 1)]
    setStep(prev)
  }

  const handleClose = () => {
    if (createCase.isPending) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!reportId) return
    if (!report) return
    if (!hasGps) return

    const finalNeedCategoryLabel = NEED_CATEGORIES.find((c) => c.id === needCategory)?.label
    const locationOverride =
      !reportHasGps && resolvedPlace && isValidCoord(resolvedPlace.lat, resolvedPlace.lng)
        ? {
            lat: resolvedPlace.lat,
            lng: resolvedPlace.lng,
            zone: resolvedPlace.name || report.location.zone,
            address: report.location.address,
            label: resolvedPlace.name || resolvedPlace.address.split(',')[0],
          }
        : undefined

    opsChannelLog('CASE', {
      entityType: 'report',
      entityId: reportId,
      action: 'wizard_submit_clicked',
      actorId: actorId ?? null,
      actorRole: 'case_manager',
      source: 'ui',
      payload: {
        operationKind: opKind,
        priority,
        needKeyOrText,
        needCategoryLabel: finalNeedCategoryLabel ?? null,
        peopleAffected,
        requiredQuantity,
        durationHours: opKind === 'citizen_coverage' ? coverageDuration : null,
        strategy,
      },
    })

    const result = await createCase.mutateAsync({
      reportId,
      actorId,
      operationKind: opKind,
      priority,
      needKeyOrText,
      needCategoryLabel: finalNeedCategoryLabel,
      peopleAffected,
      requiredQuantity: Math.max(1, requiredQuantity),
      durationHours: opKind === 'citizen_coverage' ? coverageDuration : undefined,
      locationOverride,
      strategy,
    })

    onDone({ caseId: result.case.id })
  }

  if (!open) return null

  const progress = (wizardSteps.indexOf(step) + 1) / wizardSteps.length

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[#0A0F1A]">
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0A0F1A]/95 px-4 pt-safe pb-3 lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">FARO · Wizard Operativo</p>
                <h2 className="mt-1 text-base font-semibold text-ink">Definir estrategia antes de crear el caso</h2>
                <p className="mt-0.5 text-xs text-ink-muted line-clamp-1">
                  {report ? report.description : 'Cargando reporte…'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl p-2 text-ink-faint hover:bg-white/[0.06] hover:text-ink"
                aria-label="Cerrar wizard"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/[0.08]">
              <div className="h-1.5 rounded-full bg-info" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(6.5rem,env(safe-area-inset-bottom))] pt-4 lg:px-8">
            {isLoading && (
              <GlassCard className="h-28 animate-pulse" />
            )}

            {!isLoading && !report && (
              <GlassCard className="p-5 text-sm text-ink-subtle">No encontramos este reporte.</GlassCard>
            )}

            {report && (
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {!reportHasGps && (
                  <div className="rounded-2xl border border-warning/20 bg-warning/[0.06] p-3 text-xs text-warning">
                    Este reporte no tiene GPS. Marca la ubicación antes de finalizar el wizard.
                  </div>
                )}

                {step === 'op' && (
                  <GlassCard className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-ink">Paso 1 · Tipo de operación y prioridad</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {OP_KINDS.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            setOpKind(k.id)
                            setPriority(k.priority)
                          }}
                          className={cn(
                            'rounded-2xl border p-3 text-left transition-all',
                            opKind === k.id ? 'border-info/50 bg-info/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                          )}
                        >
                          <p className="text-sm font-semibold text-ink">{k.label}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">{k.hint}</p>
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Prioridad</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPriority(p.id)}
                            className={cn(
                              'rounded-2xl border px-3 py-2 text-left transition-all',
                              priority === p.id ? 'border-info/50 bg-info/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                            )}
                          >
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', p.tone)}>
                              {p.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                )}

                {step === 'need' && (
                  <GlassCard className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-ink">Paso 2 · Necesidad (selector estándar)</p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Categoría</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                        {NEED_CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setNeedCategory(c.id)
                              if (c.keys[0]) setNeedKey(c.keys[0])
                            }}
                            className={cn(
                              'rounded-2xl border px-3 py-2 text-xs font-medium transition-all',
                              needCategory === c.id ? 'border-info/50 bg-info/10 text-ink' : 'border-white/[0.08] bg-white/[0.03] text-ink-subtle hover:bg-white/[0.05]',
                            )}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {needCategory !== 'otro' ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Producto</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {(NEED_CATEGORIES.find((c) => c.id === needCategory)?.keys ?? []).map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setNeedKey(key)}
                              className={cn(
                                'rounded-2xl border p-3 text-left transition-all',
                                needKey === key ? 'border-info/50 bg-info/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                              )}
                            >
                              <p className="text-sm font-semibold text-ink">{getResourceLabel(key)}</p>
                              <p className="mt-0.5 text-xs text-ink-muted">Clave: {key}</p>
                            </button>
                          ))}
                        </div>
                        {resolvedResourceType == null && (
                          <p className="mt-2 text-xs text-warning">
                            Este producto no está en el catálogo operativo. Podrás continuar, pero la consulta de inventario puede no devolver centros.
                          </p>
                        )}
                      </div>
                    ) : (
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Describe la necesidad</span>
                        <input
                          value={needOtherText}
                          onChange={(e) => setNeedOtherText(e.target.value)}
                          placeholder="Ej: kit de higiene, gasolina, cuerdas..."
                          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-ink outline-none focus:border-info/60"
                        />
                        <p className="text-[11px] text-ink-muted">
                          Solo se usa texto libre cuando es estrictamente necesario.
                        </p>
                      </label>
                    )}
                  </GlassCard>
                )}

                {step === 'people' && (
                  <GlassCard className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-ink">Paso 3 · Personas afectadas y cantidad requerida</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Personas afectadas</p>
                        <div className="flex flex-wrap gap-2">
                          {AFFECTED_QUICK.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPeopleAffected(n)}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                                peopleAffected === n ? 'border-info/50 bg-info/15 text-info' : 'border-white/[0.08] bg-white/[0.03] text-ink-subtle hover:bg-white/[0.05]',
                              )}
                            >
                              {n}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            value={peopleAffected}
                            onChange={(e) => setPeopleAffected(Math.max(1, Number(e.target.value) || 1))}
                            className="h-9 w-28 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-ink outline-none focus:border-info/60"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          {opKind === 'citizen_coverage' ? 'Cantidad total requerida' : 'Cantidad requerida'}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={requiredQuantity}
                            onChange={(e) => setRequiredQuantity(Math.max(1, Number(e.target.value) || 1))}
                            className="h-11 w-40 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-ink outline-none focus:border-info/60"
                          />
                          <span className="text-sm text-ink-muted">{unit}</span>
                        </div>
                        {resolvedResourceType && (
                          <p className="mt-1 text-[11px] text-ink-faint">
                            Recomendado mínimo: {getResourceMinRecommended(resolvedResourceType)} {getResourceUnit(resolvedResourceType)}
                          </p>
                        )}
                      </div>
                    </div>

                    {opKind === 'citizen_coverage' && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Duración</p>
                        <div className="grid grid-cols-3 gap-2">
                          {COVERAGE_DURATIONS.map((d) => (
                            <button
                              key={d.hours}
                              type="button"
                              onClick={() => setCoverageDuration(d.hours)}
                              className={cn(
                                'rounded-2xl border px-3 py-2 text-xs font-semibold transition-all',
                                coverageDuration === d.hours ? 'border-info/50 bg-info/15 text-info' : 'border-white/[0.08] bg-white/[0.03] text-ink-subtle hover:bg-white/[0.05]',
                              )}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!reportHasGps && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Ubicación GPS</p>
                        <LocationPickerMap value={resolvedPlace} onChange={setResolvedPlace} className="min-h-[280px]" />
                      </div>
                    )}
                  </GlassCard>
                )}

                {step === 'inventory' && (
                  <GlassCard className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-ink">Paso 4 · Consulta automática de inventario</p>
                    </div>
                    {!hasGps && (
                      <p className="rounded-2xl border border-warning/20 bg-warning/[0.06] px-3 py-2 text-xs text-warning">
                        Falta GPS. Marca la ubicación para consultar inventarios.
                      </p>
                    )}
                    {!resolvedResourceType && (
                      <p className="text-xs text-ink-muted">
                        Sin clave estándar para “{needKeyOrText || 'Otro'}”. No se puede buscar coincidencias exactas en inventario.
                      </p>
                    )}

                    {resolvedResourceType && (
                      <>
                        <p className="text-xs text-ink-muted">
                          Buscando centros con <span className="text-ink font-semibold">{needLabel}</span> disponible…
                        </p>
                        {centersLoading && <GlassCard className="h-20 animate-pulse" />}
                        {centersError && <p className="text-xs text-critical">{centersError}</p>}
                        {!centersLoading && !centersError && compatibleCenters.length === 0 && (
                          <p className="text-xs text-ink-muted">No hay centros compatibles (con stock libre) para este recurso.</p>
                        )}
                        <div className="space-y-2">
                          {compatibleCenters.map((c) => (
                            <div
                              key={c.centerId}
                              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-ink">{c.centerName}</p>
                                  <p className="mt-0.5 text-xs text-ink-muted">
                                    {c.distanceKm} km · {c.operationalMode} · {c.dispatchMode ?? 'mixed'}
                                  </p>
                                </div>
                                <p className="text-sm font-bold tabular-nums text-operational">
                                  {c.available} {c.unit}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </GlassCard>
                )}

                {step === 'decision' && (
                  <GlassCard className="p-4 space-y-4">
                    <p className="text-sm font-semibold text-ink">Paso 5 · Decisión operativa</p>

                    {opKind === 'citizen_coverage' ? (
                      <div className="rounded-2xl border border-info/20 bg-info/[0.05] p-3 text-xs text-ink-muted">
                        Cobertura ciudadana no usa radar clásico: se abrirá una convocatoria pública con reservas al finalizar.
                      </div>
                    ) : compatibleCenters.length > 0 ? (
                      <>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Centro compatible</p>
                          <div className="space-y-2">
                            {compatibleCenters.map((c) => (
                              <button
                                key={c.centerId}
                                type="button"
                                onClick={() => setSelectedCenterId(c.centerId)}
                                className={cn(
                                  'w-full rounded-2xl border p-3 text-left transition-all',
                                  selectedCenterId === c.centerId ? 'border-info/50 bg-info/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink">{c.centerName}</p>
                                    <p className="mt-0.5 text-xs text-ink-muted">{c.distanceKm} km · {c.operationalMode}</p>
                                  </div>
                                  <p className="text-sm font-bold tabular-nums text-operational">{c.available} {c.unit}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            ¿El centro dispone de brigada o delivery?
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              ['yes', 'Sí'],
                              ['no', 'No'],
                              ['unknown', 'Desconocido'],
                            ] as const).map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setDispatchAnswer(id)}
                                className={cn(
                                  'rounded-2xl border px-3 py-2 text-xs font-semibold transition-all',
                                  dispatchAnswer === id ? 'border-info/50 bg-info/15 text-info' : 'border-white/[0.08] bg-white/[0.03] text-ink-subtle hover:bg-white/[0.05]',
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {dispatchAnswer === 'no' && (
                            <label className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-ink-subtle">
                              <input
                                type="checkbox"
                                checked={openVolunteerCallIfNo}
                                onChange={(e) => setOpenVolunteerCallIfNo(e.target.checked)}
                                className="rounded border-white/20"
                              />
                              Ofrecer abrir convocatoria de voluntarios (reservas parciales)
                            </label>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-ink-muted">
                          No hay centros compatibles. Puedes dejar el caso en revisión manual o abrir convocatoria.
                        </p>
                        <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-ink-subtle">
                          <input
                            type="checkbox"
                            checked={manualOpenCall}
                            onChange={(e) => setManualOpenCall(e.target.checked)}
                            className="rounded border-white/20"
                          />
                          Abrir convocatoria de voluntarios al crear el caso
                        </label>
                      </div>
                    )}
                  </GlassCard>
                )}

                {step === 'confirm' && (
                  <GlassCard className="p-4 space-y-4">
                    <p className="text-sm font-semibold text-ink">Confirmación</p>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs space-y-2">
                      <Row k="Tipo" v={OP_KINDS.find((k) => k.id === opKind)?.label ?? opKind} />
                      <Row k="Prioridad" v={PRIORITIES.find((p) => p.id === priority)?.label ?? priority} />
                      <Row k="Necesidad" v={needLabel} />
                      <Row k="Requerido" v={`${requiredQuantity} ${unit}`} />
                      <Row k="Personas afectadas" v={`${peopleAffected}`} />
                      {opKind === 'citizen_coverage' && <Row k="Duración" v={`${coverageDuration}h`} />}
                      <Row k="GPS" v={hasGps ? 'Confirmado' : 'Falta'} tone={hasGps ? 'text-operational' : 'text-critical'} />
                      <Row
                        k="Estrategia"
                        v={
                          strategy.mode === 'center_first'
                            ? `Centro primero (${strategy.centerId.slice(0, 8)}…)`
                            : strategy.mode === 'open_volunteer_call'
                              ? 'Convocatoria de voluntarios'
                              : 'Revisión manual'
                        }
                      />
                    </div>

                    {createCase.error && (
                      <p className="rounded-2xl border border-critical/25 bg-critical/[0.08] px-3 py-2 text-xs text-critical">
                        {createCase.error instanceof Error ? createCase.error.message : 'No se pudo crear el caso'}
                      </p>
                    )}
                  </GlassCard>
                )}
              </div>
            )}
          </main>

          <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-[#0A0F1A]/95 px-4 pb-safe pt-3 lg:px-8">
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
              <EmergencyButton variant="glass" size="md" onClick={goBack} disabled={step === 'op' || createCase.isPending}>
                Atrás
              </EmergencyButton>
              <div className="flex-1" />
              {step !== 'confirm' ? (
                <EmergencyButton
                  variant="primary"
                  size="md"
                  onClick={goNext}
                  disabled={!canContinue || createCase.isPending}
                >
                  Continuar <ChevronRight className="ml-1 h-4 w-4" />
                </EmergencyButton>
              ) : (
                <EmergencyButton
                  variant="primary"
                  size="md"
                  onClick={() => void handleSubmit()}
                  disabled={!canContinue || createCase.isPending}
                >
                  {createCase.isPending ? 'Creando…' : 'Crear caso operativo'}
                </EmergencyButton>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{k}</span>
      <span className={cn('font-semibold text-ink', tone)}>{v}</span>
    </div>
  )
}

