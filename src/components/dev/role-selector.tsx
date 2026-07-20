import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { ALL_ROLES, ROLE_LABELS } from '@/services/dev-service'
import type { FaroRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<FaroRole, string> = {
  public: 'text-ink-subtle',
  volunteer: 'text-operational',
  case_manager: 'text-info',
  coordinator: 'text-warning',
  regional_admin: 'text-critical',
  super_admin: 'text-critical',
}

interface RoleSelectorProps {
  value: FaroRole
  onChange: (role: FaroRole) => void
  disabled?: boolean
}

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
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
        <span className={cn('font-medium', ROLE_COLORS[value])}>
          {ROLE_LABELS[value]}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <GlassCard className="absolute z-50 mt-1 w-full p-1">
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                onChange(role)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center rounded-2xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.08]',
                value === role && 'bg-info/15',
              )}
            >
              <span className={cn('font-medium', ROLE_COLORS[role])}>
                {ROLE_LABELS[role]}
              </span>
            </button>
          ))}
        </GlassCard>
      )}
    </div>
  )
}
