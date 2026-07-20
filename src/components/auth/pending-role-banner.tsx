import { Clock3 } from 'lucide-react'
import { hasPendingNetworkRoleRequest, pendingRoleLabel } from '@/lib/roles'
import { useAuth } from '@/store/auth-context'

/** Banner visible mientras una solicitud de Gestor/Coordinador está en revisión. */
export function PendingRoleBanner() {
  const { profile } = useAuth()
  if (!hasPendingNetworkRoleRequest(profile)) return null

  const roleName = pendingRoleLabel(profile?.pending_role)

  return (
    <div className="border-b border-[#3A2A0F] bg-[#3A2A0F]/80 px-4 py-2.5 text-sm text-[#FAC775]">
      <div className="mx-auto flex max-w-6xl items-start gap-2">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Tu solicitud para <span className="font-semibold text-[#F2F6FA]">{roleName}</span> está siendo
          revisada. Mientras tanto usas FARO con permisos de Voluntario.
        </p>
      </div>
    </div>
  )
}
