import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { LocationPickerMap } from '@/components/faro/location-picker-map'
import { useReportAnalysis, useConvertReportToCase } from '@/hooks/useCaseManager'
import { cn, isValidCoord } from '@/lib/utils'
import { SITE_TYPE_LABELS, label } from '@/lib/labels'
import type { ResolvedPlace } from '@/lib/osm-geocoding'
import { reportRepository } from '@/repositories/report-repository'

type WizardStep = 'classification' | 'details' | 'center' | 'location' | 'confirm'

interface ConvertReportWizardProps {
  reportId: string
  onDone: () => void
  onCancel: () => void
}

const PRIORITIES = [
  { value: 'critical', label: 'Crítica', color: 'bg-critical/20 text-critical' },
  { value: 'high', label: 'Alta', color: 'bg-warning/20 text-warning' },
  { value: 'medium', label: 'Media', color: 'bg-info/20 text-info' },
  { value: 'low', label: 'Baja', color: 'bg-white/10 text-ink-subtle' },
] as const

const CATEGORIES = [
  { value: 'need', label: 'Necesidad' },
  { value: 'damage', label: 'Daño' },
  { value: 'health', label: 'Salud' },
  { value: 'shelter', label: 'Refugio' },
] as const

export function ConvertReportWizard({ reportId, onDone, onCancel }: ConvertReportWizardProps) {
  const { data: analysis } = useReportAnalysis(reportId)
  const convert = useConvertReportToCase()

  const [step, setStep] = useState<WizardStep>('classification')
  const [priority, setPriority] = useState<string>('medium')
  const [category, setCategory] = useState<string>('need')
  const [title, setTitle] = useState('')
  const [affectedCount, setAffectedCount] = useState(1)
  const [selectedCenterId, setSelectedCenterId] = useState<string | undefined>()
  const [selectedCenterName, setSelectedCenterName] = useState<string | undefined>()
  const [resolvedPlace, setResolvedPlace] = useState<ResolvedPlace | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const report = analysis?.report
  const nearby = analysis?.nearbyCenters ?? []
  const reportHasGps = Boolean(
    report && isValidCoord(report.location.coordinates.lat, report.location.coordinates.lng),
  )
  const hasGps = reportHasGps || Boolean(resolvedPlace && isValidCoord(resolvedPlace.lat, resolvedPlace.lng))

  const wizardData = useMemo(() => ({
    reportId,
    title: title || (report?.description ?? '').slice(0, 80),
    description: report?.description ?? '',
    priority: priority as 'critical' | 'high' | 'medium' | 'low',
    category,
    zone: resolvedPlace?.name || report?.location.zone || 'Zona por confirmar',
    affectedCount,
    selectedCenterId,
    selectedCenterName,
  }), [reportId, title, report, priority, category, affectedCount, selectedCenterId, selectedCenterName, resolvedPlace])

  const goAfterCenter = () => {
    setStep(reportHasGps ? 'confirm' : 'location')
  }

  const handleConvert = async () => {
    setConverting(true)
    setConvertError(null)
    try {
      if (!reportHasGps && resolvedPlace && isValidCoord(resolvedPlace.lat, resolvedPlace.lng)) {
        await reportRepository.updateLocation({
          id: reportId,
          latitude: resolvedPlace.lat,
          longitude: resolvedPlace.lng,
          siteLabel: resolvedPlace.name || resolvedPlace.address.split(',')[0],
        })
      }
      await convert.mutateAsync(wizardData)
      setDone(true)
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'No se pudo convertir el reporte')
    } finally {
      setConverting(false)
    }
  }

  if (done) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-lg font-semibold text-ink mb-2">Caso creado</p>
        <p className="text-sm text-ink-subtle mb-4">
          Necesidad pública publicada. Ya puede aparecer en el radar de voluntarios.
        </p>
        <EmergencyButton variant="primary" size="sm" onClick={onDone}>Aceptar</EmergencyButton>
      </GlassCard>
    )
  }

  const steps: WizardStep[] = reportHasGps
    ? ['classification', 'details', 'center', 'confirm']
    : ['classification', 'details', 'center', 'location', 'confirm']

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 mb-4">
        {steps.map((s) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              steps.indexOf(s) <= steps.indexOf(step) ? 'bg-info' : 'bg-white/[0.08]',
            )}
          />
        ))}
      </div>

      {step === 'classification' && (
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Clasificación del caso</h3>
          {!reportHasGps && (
            <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
              Este reporte no tiene GPS. Podrás marcarlo en el mapa antes de publicar.
            </p>
          )}
          <div>
            <p className="text-xs font-medium text-ink-subtle mb-2">Prioridad</p>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className={cn('rounded-xl border px-3 py-2 text-sm font-medium transition-all', priority === p.value ? 'border-info/50 bg-info/10' : 'border-white/[0.06] bg-white/[0.03] text-ink-subtle')}
                >
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-1', p.color)}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-subtle mb-2">Categoría</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className={cn('rounded-xl border px-3 py-2 text-sm font-medium transition-all', category === c.value ? 'border-info/50 bg-info/10 text-info' : 'border-white/[0.06] bg-white/[0.03] text-ink-subtle')}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <EmergencyButton variant="glass" size="sm" onClick={onCancel}>Cancelar</EmergencyButton>
            <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={() => setStep('details')}>Continuar</EmergencyButton>
          </div>
        </GlassCard>
      )}

      {step === 'details' && (
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Detalles del caso</h3>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={(report?.description ?? '').slice(0, 80)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Personas afectadas</span>
            <input type="number" min={1} value={affectedCount} onChange={(e) => setAffectedCount(parseInt(e.target.value) || 1)}
              className="h-10 w-24 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/50"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('classification')}>Atrás</EmergencyButton>
            <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={() => setStep('center')}>Continuar</EmergencyButton>
          </div>
        </GlassCard>
      )}

      {step === 'center' && (
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Centro recomendado (opcional)</h3>
          <p className="text-xs text-ink-subtle">
            Solo selecciónalo si la necesidad requiere infraestructura física. Para ayuda móvil, puedes continuar sin centro.
          </p>
          {nearby.length === 0 && <p className="text-xs text-ink-muted">No hay centros cercanos disponibles</p>}
          <div className="space-y-2">
            {nearby.map((center) => (
              <button key={center.id} onClick={() => { setSelectedCenterId(center.id); setSelectedCenterName(center.name) }}
                className={cn('w-full rounded-xl border px-3 py-2 text-left transition-all', selectedCenterId === center.id ? 'border-info/50 bg-info/10' : 'border-white/[0.06] bg-white/[0.03]')}
              >
                <p className="text-sm font-medium text-ink">{center.name}</p>
                <p className="text-xs text-ink-subtle">
                  {center.distance} km · {label(SITE_TYPE_LABELS, center.type, center.type)}
                </p>
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('details')}>Atrás</EmergencyButton>
            <EmergencyButton variant="primary" size="sm" className="flex-1" onClick={goAfterCenter}>Continuar</EmergencyButton>
          </div>
        </GlassCard>
      )}

      {step === 'location' && (
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Ubicación GPS requerida</h3>
          <p className="text-xs text-ink-subtle">
            Sin coordenadas los voluntarios no verán el punto en el mapa. Marca la ubicación aproximada.
          </p>
          <LocationPickerMap value={resolvedPlace} onChange={setResolvedPlace} className="min-h-[260px]" />
          <div className="flex gap-2 pt-2">
            <EmergencyButton variant="glass" size="sm" onClick={() => setStep('center')}>Atrás</EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={!resolvedPlace || !isValidCoord(resolvedPlace.lat, resolvedPlace.lng)}
              onClick={() => setStep('confirm')}
            >
              Continuar
            </EmergencyButton>
          </div>
        </GlassCard>
      )}

      {step === 'confirm' && (
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink">Confirmar conversión</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-ink-subtle">Título</span><span className="text-ink font-medium">{wizardData.title}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Prioridad</span><span className="text-ink">{PRIORITIES.find((p) => p.value === priority)?.label}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Categoría</span><span className="text-ink">{CATEGORIES.find((c) => c.value === category)?.label}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Afectados</span><span className="text-ink">{affectedCount}</span></div>
            <div className="flex justify-between"><span className="text-ink-subtle">Centro</span><span className="text-ink">{selectedCenterName ?? 'No asignado'}</span></div>
            <div className="flex justify-between">
              <span className="text-ink-subtle">GPS</span>
              <span className={cn('font-medium', hasGps ? 'text-operational' : 'text-critical')}>
                {hasGps ? 'Confirmado' : 'Falta'}
              </span>
            </div>
          </div>
          {convertError && <p className="text-xs text-critical">{convertError}</p>}
          <div className="flex gap-2 pt-2">
            <EmergencyButton
              variant="glass"
              size="sm"
              onClick={() => setStep(reportHasGps ? 'center' : 'location')}
            >
              Atrás
            </EmergencyButton>
            <EmergencyButton
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={handleConvert}
              disabled={converting || !hasGps}
            >
              {converting ? 'Creando...' : 'Crear caso y publicar necesidad'}
            </EmergencyButton>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
