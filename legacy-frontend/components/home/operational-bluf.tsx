'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRealtimeCenters } from '../../hooks/useRealtimeCenters'
import { supabase } from '../../lib/supabase/client'

type ReportRecord = Record<string, unknown>

interface OperationalSnapshot {
  redCount: number
  totalReports: number
  criticalSites: string[]
  source: 'live' | 'mock'
  generatedAt: string
}

const RED_HINTS = ['red', 'rojo', 'critical', 'critico', 'saturated', 'severe', 'alta']
const SITE_FIELDS = ['center_name', 'site_name', 'name', 'facility_name', 'location_name'] as const
const SEVERITY_FIELDS = ['severity', 'status', 'priority', 'priority_level', 'saturation_level'] as const

function getStringField(record: ReportRecord, fields: readonly string[]) {
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.toLowerCase()
    }
  }
  return ''
}

function getSiteLabel(record: ReportRecord) {
  for (const field of SITE_FIELDS) {
    const value = record[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return 'Centro en verificacion'
}

function isRedReport(record: ReportRecord) {
  const severityText = getStringField(record, SEVERITY_FIELDS)
  return RED_HINTS.some((hint) => severityText.includes(hint))
}

function buildSnapshot(records: ReportRecord[]): OperationalSnapshot {
  const redReports = records.filter(isRedReport)

  if (records.length === 0) {
    return {
      redCount: 1,
      totalReports: 1,
      criticalSites: ['Hospital central sin camas UCI'],
      source: 'mock',
      generatedAt: new Date().toISOString(),
    }
  }

  if (redReports.length === 0) {
    return {
      redCount: 1,
      totalReports: records.length,
      criticalSites: ['Sin etiqueta roja explicita: mantener monitoreo activo'],
      source: 'mock',
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    redCount: redReports.length,
    totalReports: records.length,
    criticalSites: redReports.slice(0, 3).map(getSiteLabel),
    source: 'live',
    generatedAt: new Date().toISOString(),
  }
}

export function OperationalBluf() {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot>(() => buildSnapshot([]))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [optimisticCriticalSites, setOptimisticCriticalSites] = useState<string[]>([])

  const refreshSnapshot = useCallback(async () => {
    setIsRefreshing(true)

    const { data, error } = await supabase
      .from('operational_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      setSnapshot(buildSnapshot([]))
      setErrorMessage('Sin datos en vivo por ahora; se muestra estado mock operativo.')
      setIsRefreshing(false)
      return
    }

    const rows = (data ?? []) as ReportRecord[]
    setSnapshot(buildSnapshot(rows))
    setErrorMessage(null)
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    void refreshSnapshot()
  }, [refreshSnapshot])

  useRealtimeCenters({
    onOperationalReportChanged: () => {
      void refreshSnapshot()
    },
  })

  useEffect(() => {
    const onOptimistic = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; siteLabel: string; saturation: string }>).detail
      if (!detail || detail.saturation !== 'rojo') return
      setOptimisticCriticalSites((prev) => [detail.siteLabel, ...prev].slice(0, 3))
    }

    const onRollback = () => {
      setOptimisticCriticalSites([])
    }

    const onConfirm = () => {
      setOptimisticCriticalSites([])
      void refreshSnapshot()
    }

    window.addEventListener('operational-report:optimistic', onOptimistic as EventListener)
    window.addEventListener('operational-report:rollback', onRollback)
    window.addEventListener('operational-report:confirm', onConfirm)
    return () => {
      window.removeEventListener('operational-report:optimistic', onOptimistic as EventListener)
      window.removeEventListener('operational-report:rollback', onRollback)
      window.removeEventListener('operational-report:confirm', onConfirm)
    }
  }, [refreshSnapshot])

  const updatedLabel = useMemo(() => {
    const date = new Date(snapshot.generatedAt)
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  }, [snapshot.generatedAt])

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-red-200/80 bg-red-50/85 p-4 shadow-sm backdrop-blur-md">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-red-700">BLUF coordinacion</p>
        <h1 className="m-0 mt-1 text-xl font-bold text-red-900">
          {snapshot.redCount + optimisticCriticalSites.length} foco(s) rojos requieren accion inmediata
        </h1>
        <p className="m-0 mt-2 text-sm text-red-800">
          Priorizar llamados y derivacion en los primeros 5 minutos de cada alerta.
        </p>
        <p className="m-0 mt-2 text-xs text-red-700/90">
          Fuente: {snapshot.source === 'live' ? 'operational_reports' : 'mock funcional'} · Actualizado:{' '}
          {updatedLabel}
          {isRefreshing ? ' · refrescando...' : ''}
        </p>
      </div>

      <div className="glass-card p-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Sitios criticos ahora</p>
        <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {[...optimisticCriticalSites, ...snapshot.criticalSites].slice(0, 3).map((site) => (
            <li key={site}>{site}</li>
          ))}
        </ul>
        <p className="m-0 mt-2 text-xs text-slate-500">
          {snapshot.totalReports} reportes considerados para este corte operativo.
        </p>
        {errorMessage && <p className="m-0 mt-2 text-xs text-amber-700">{errorMessage}</p>}
      </div>
    </section>
  )
}
