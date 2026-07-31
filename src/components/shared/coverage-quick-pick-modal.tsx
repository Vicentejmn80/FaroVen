import { EmergencyButton } from '@/components/ui/emergency-button'
import { COVERAGE_QUICK_PICK_QTY } from '@/domain/ops-pipeline-contract'
import { cn } from '@/lib/utils'

/**
 * Modal elegante de cantidad rápida — sin input libre.
 * Opciones: 5 / 10 / 20 / Todo lo restante (si cabe).
 */
export function CoverageQuickPickModal({
  open,
  title = '¿Cuánto puedes comprometer?',
  remaining,
  unit = 'unidades',
  loading,
  onClose,
  onPick,
}: {
  open: boolean
  title?: string
  remaining: number
  unit?: string
  loading?: boolean
  onClose: () => void
  onPick: (qty: number) => void
}) {
  if (!open) return null

  const options = [
    ...COVERAGE_QUICK_PICK_QTY.filter((q) => q < remaining),
    ...(remaining > 0 ? (['all'] as const) : []),
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Cerrar" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1220] p-4 shadow-2xl space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">FARO</p>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Restante por cubrir: {remaining} {unit}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {options.map((opt) => {
            const qty = opt === 'all' ? remaining : opt
            const label = opt === 'all' ? `Todo (${remaining})` : String(opt)
            return (
              <button
                key={String(opt)}
                type="button"
                disabled={loading || qty <= 0}
                onClick={() => onPick(qty)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm font-semibold transition-colors',
                  'border-white/10 bg-white/[0.04] text-ink hover:bg-info/15 hover:border-info/40',
                  loading && 'opacity-50',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <EmergencyButton variant="glass" size="sm" className="w-full" onClick={onClose} disabled={loading}>
          Cancelar
        </EmergencyButton>
      </div>
    </div>
  )
}
