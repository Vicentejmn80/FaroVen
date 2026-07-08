import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { NeedItemLabel } from '@/components/faro/need-item-label'
import { useCoordinatorMutations } from '@/hooks/useCoordinatorMutations'
import { timeAgo } from '@/lib/utils'
import type { Need } from '@/domain/models'

type Step = 'input' | 'confirm' | 'no_resources'

interface NeedCycleClosureModalProps {
  needs: Need[]
  centerName?: string
  onComplete?: () => void
}

export function NeedCycleClosureModal({ needs, centerName, onComplete }: NeedCycleClosureModalProps) {
  const { closeNeedCycle } = useCoordinatorMutations()
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('input')
  const [received, setReceived] = useState('')
  const [pendingRemaining, setPendingRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = needs[index]
  const startedAt = current?.cycleStartedAt ?? current?.createdAt
  const elapsedLabel = startedAt ? timeAgo(startedAt) : '—'
  const totalReceived = useMemo(() => Number(received) || 0, [received])

  useEffect(() => {
    if (!needs.length) {
      onComplete?.()
      return
    }
    if (index >= needs.length) setIndex(0)
  }, [needs.length, index, onComplete])

  useEffect(() => {
    setStep('input')
    setReceived('')
    setPendingRemaining(null)
    setError(null)
  }, [current?.id])

  if (!current) return null

  const computeRemaining = () => {
    const total = Math.max(0, current.available + totalReceived)
    return Math.max(0, current.required - total)
  }

  const handleSubmit = async (continueCycle: boolean, reason: string | null) => {
    setError(null)
    try {
      await closeNeedCycle.mutateAsync({
        needId: current.id,
        receivedQty: totalReceived,
        continueCycle,
        closureReason: reason,
      })
      setIndex((prev) => (prev + 1 >= needs.length ? 0 : prev + 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el resultado.')
    }
  }

  const onPrimary = () => {
    if (!received.trim()) {
      setError('Indica una cantidad recibida.')
      return
    }
    const remaining = computeRemaining()
    if (totalReceived <= 0) {
      setStep('no_resources')
      setPendingRemaining(remaining)
      return
    }
    if (remaining <= 0) {
      void handleSubmit(false, 'resolved_full')
      return
    }
    setPendingRemaining(remaining)
    setStep('confirm')
  }

  const onNoResources = () => {
    setReceived('0')
    setPendingRemaining(current.required)
    setStep('no_resources')
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md space-y-4 border-warning/30">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">Actualizar resultado de la necesidad</p>
          <p className="mt-1 text-[18px] font-semibold text-ink">Actualizar resultado de la necesidad</p>
        </div>

        <div className="space-y-1.5 text-sm text-ink-subtle">
          <NeedItemLabel name={current.type} className="text-base font-semibold text-ink" />
          <p>Centro: {centerName ?? 'Centro asignado'}</p>
          <p>Cantidad solicitada: {current.required}</p>
          <p>Tiempo transcurrido: {elapsedLabel}</p>
        </div>

        {step === 'input' && (
          <>
            <label className="block text-sm text-ink-subtle">
              ¿Cuántas unidades recibiste durante este ciclo?
              <input
                type="number"
                min={0}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink outline-none"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <EmergencyButton
                variant="primary"
                size="md"
                className="w-full"
                disabled={closeNeedCycle.isPending}
                onClick={onPrimary}
              >
                Registrar resultado
              </EmergencyButton>
              <EmergencyButton variant="glass" size="md" className="w-full" onClick={onNoResources}>
                No llegó ninguna
              </EmergencyButton>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p className="text-sm text-ink-subtle">
              Faltan {pendingRemaining ?? 0} unidades para cubrir la necesidad.
            </p>
            <p className="text-sm text-ink">¿Deseas continuar solicitando las unidades restantes?</p>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <EmergencyButton
                variant="primary"
                size="md"
                className="w-full"
                disabled={closeNeedCycle.isPending}
                onClick={() => void handleSubmit(true, 'reopened')}
              >
                Sí
              </EmergencyButton>
              <EmergencyButton
                variant="glass"
                size="md"
                className="w-full"
                disabled={closeNeedCycle.isPending}
                onClick={() => void handleSubmit(false, 'closed_by_coordinator')}
              >
                No
              </EmergencyButton>
            </div>
          </>
        )}

        {step === 'no_resources' && (
          <>
            <p className="text-sm text-ink-subtle">No llegaron recursos durante este ciclo.</p>
            <p className="text-sm text-ink">¿Deseas mantener esta necesidad activa?</p>
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <EmergencyButton
                variant="primary"
                size="md"
                className="w-full"
                disabled={closeNeedCycle.isPending}
                onClick={() => void handleSubmit(true, 'no_resources_reopen')}
              >
                Sí
              </EmergencyButton>
              <EmergencyButton
                variant="glass"
                size="md"
                className="w-full"
                disabled={closeNeedCycle.isPending}
                onClick={() => void handleSubmit(false, 'no_resources_close')}
              >
                No
              </EmergencyButton>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  )
}
