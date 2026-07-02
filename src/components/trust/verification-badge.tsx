import { cn } from '@/lib/utils'

export type VerificationKind = 'citizen_pending' | 'verified' | 'coordinator'

const CONFIG: Record<
  VerificationKind,
  { label: string; sublabel?: string; className: string }
> = {
  citizen_pending: {
    label: 'Información ciudadana',
    sublabel: 'Pendiente de validación',
    className: 'border-warning/35 bg-warning/10 text-warning',
  },
  verified: {
    label: 'Información verificada',
    className: 'border-operational/35 bg-operational/10 text-operational',
  },
  coordinator: {
    label: 'Verificado',
    className: 'border-info/35 bg-info/10 text-info',
  },
}

interface VerificationBadgeProps {
  kind: VerificationKind
  validatedBy?: string
  className?: string
}

export function VerificationBadge({ kind, validatedBy, className }: VerificationBadgeProps) {
  const config = CONFIG[kind]
  return (
    <div
      className={cn(
        'inline-flex flex-col rounded-2xl border px-3 py-2 text-left',
        config.className,
        className,
      )}
    >
      <span className="text-xs font-semibold">{config.label}</span>
      {config.sublabel && <span className="text-[11px] opacity-90">{config.sublabel}</span>}
      {kind === 'verified' && validatedBy && (
        <span className="mt-0.5 text-[11px] opacity-90">Validado por {validatedBy}</span>
      )}
    </div>
  )
}
