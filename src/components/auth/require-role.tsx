import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import type { FaroRole } from '@/lib/roles'
import { useAuth } from '@/store/auth-context'

interface RequireRoleProps {
  allowed: FaroRole[]
  children: ReactNode
  fallback?: ReactNode
  onRequestAuth?: () => void
}

export function RequireRole({ allowed, children, fallback, onRequestAuth }: RequireRoleProps) {
  const { role, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-ink-muted">
        Verificando permisos…
      </div>
    )
  }

  if (!allowed.includes(role)) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="px-4 pt-6">
        <GlassCard className="space-y-3 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <p className="text-[15px] font-medium text-ink">Acceso restringido</p>
          <p className="text-sm text-ink-muted">
            {!user
              ? 'Inicia sesión con una cuenta autorizada para acceder a esta sección.'
              : 'Tu cuenta no tiene permisos para esta sección.'}
          </p>
          {!user && onRequestAuth && (
            <EmergencyButton variant="primary" size="md" className="w-full" onClick={onRequestAuth}>
              Iniciar sesión
            </EmergencyButton>
          )}
        </GlassCard>
      </div>
    )
  }

  return <>{children}</>
}
