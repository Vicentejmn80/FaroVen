import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { PARTICIPATION_INTENT_LABELS } from '@/services/dev-service'
import { cn } from '@/lib/utils'

type IntentValue = 'need_help' | 'want_to_help' | 'represent_org' | null

const INTENT_OPTIONS: Array<{ value: IntentValue; label: string }> = [
  { value: null, label: 'Sin definir' },
  { value: 'need_help', label: PARTICIPATION_INTENT_LABELS.need_help },
  { value: 'want_to_help', label: PARTICIPATION_INTENT_LABELS.want_to_help },
  { value: 'represent_org', label: PARTICIPATION_INTENT_LABELS.represent_org },
]

interface IntentSelectorProps {
  value: IntentValue
  onChange: (intent: IntentValue) => void
  disabled?: boolean
}

export function IntentSelector({ value, onChange, disabled }: IntentSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLabel = value ? PARTICIPATION_INTENT_LABELS[value] : 'Sin definir'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm transition-colors',
          disabled ? 'opacity-50' : 'hover:border-info/30',
        )}
      >
        <span className={cn('font-medium', value ? 'text-ink' : 'text-ink-faint')}>
          {currentLabel}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <GlassCard className="absolute z-50 mt-1 w-full p-1">
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value ?? 'null'}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center rounded-2xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.08]',
                value === opt.value && 'bg-info/15',
              )}
            >
              <span className={cn('font-medium', opt.value ? 'text-ink' : 'text-ink-faint')}>
                {opt.label}
              </span>
            </button>
          ))}
        </GlassCard>
      )}
    </div>
  )
}
