import { useState } from 'react'
import { FlowSheet, FormField, fieldClassName, textareaClassName } from '@/components/faro/flow-sheet'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useCreateCase } from '@/hooks/useCaseMutations'
import { useAuth } from '@/store/auth-context'
import type { CasePriority } from '@/domain/case-lifecycle.types'
import { cn } from '@/lib/utils'

interface CreateCaseFormProps {
  onClose: () => void
  onCreated?: (caseId: string) => void
}

const PRIORITIES: Array<{ value: CasePriority; label: string }> = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

export function CreateCaseForm({ onClose, onCreated }: CreateCaseFormProps) {
  const { user } = useAuth()
  const createCase = useCreateCase()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [zone, setZone] = useState('')
  const [priority, setPriority] = useState<CasePriority>('high')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [affectedCount, setAffectedCount] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !zone.trim()) {
      setError('Título y zona son obligatorios.')
      return
    }
    try {
      const result = await createCase.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        zone: zone.trim(),
        priority,
        affectedCount: Math.max(1, Number(affectedCount) || 1),
        reporterInfo: {
          name: reporterName.trim() || undefined,
          phone: reporterPhone.trim() || undefined,
        },
        actorId: user?.id,
      })
      onCreated?.(result.case.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el caso.')
    }
  }

  return (
    <FlowSheet title="Crear caso manualmente" subtitle="Registro directo en el flujo operativo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 px-1 pb-8">
        <FormField label="Título del caso">
          <input
            className={fieldClassName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Familia sin refugio en La Guaira"
            required
          />
        </FormField>

        <FormField label="Zona / sector">
          <input
            className={fieldClassName}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Ej. Maiquetía, Sector 3"
            required
          />
        </FormField>

        <FormField label="Prioridad">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={
                  priority === p.value
                    ? 'rounded-xl border border-info/40 bg-info/15 px-2 py-2 text-xs font-semibold text-info'
                    : 'rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-xs text-ink-muted'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Descripción">
          <textarea
            className={cn(textareaClassName, 'resize-y')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Necesidades, contexto y urgencia…"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Afectados">
            <input
              type="number"
              min={1}
              className={fieldClassName}
              value={affectedCount}
              onChange={(e) => setAffectedCount(e.target.value)}
            />
          </FormField>
          <FormField label="Teléfono contacto">
            <input
              className={fieldClassName}
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
        </div>

        <FormField label="Nombre del ciudadano">
          <input
            className={fieldClassName}
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            placeholder="Opcional"
          />
        </FormField>

        {error && <p className="text-sm text-critical">{error}</p>}

        <EmergencyButton type="submit" className="w-full" disabled={createCase.isPending}>
          {createCase.isPending ? 'Creando…' : 'Crear caso'}
        </EmergencyButton>
      </form>
    </FlowSheet>
  )
}
