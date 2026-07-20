import { useState } from 'react'
import { Shield } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { SectionHeader } from '@/components/coordinator/section-header'
import { UserSearchInput } from './user-search-input'
import { UserDetailCard } from './user-detail-card'
import { RoleSelector } from './role-selector'
import { RoleConfirmationDialog } from './role-confirmation-dialog'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import { changeUserRole, type DevProfileRow } from '@/services/dev-service'
import type { FaroRole } from '@/lib/roles'

export function RoleLabModule() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [selectedUser, setSelectedUser] = useState<DevProfileRow | null>(null)
  const [pendingRole, setPendingRole] = useState<FaroRole | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isSelf = selectedUser?.id === currentUser?.id

  const handleRoleChange = (role: FaroRole) => {
    if (!selectedUser) return
    if (isSelf) {
      showToast('No puedes modificar tu propio rol', 'warning')
      return
    }
    if (selectedUser.role === 'super_admin' && role !== 'super_admin') {
      showToast('No puedes modificar el rol de un Super Admin', 'warning')
      return
    }
    setPendingRole(role)
    setConfirmOpen(true)
  }

  const confirmRoleChange = async () => {
    if (!selectedUser || !pendingRole) return
    setLoading(true)
    try {
      const updated = await changeUserRole(
        selectedUser.id,
        pendingRole,
        'Laboratorio FARO — cambio manual de rol',
      )
      setSelectedUser(updated)
      setConfirmOpen(false)
      setPendingRole(null)
      showToast(`Rol de ${updated.full_name} cambiado a ${pendingRole}`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      showToast(`Error: ${message}`, 'warning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Cambio de Roles"
        subtitle="Busca un usuario y cambia su rol manualmente"
        icon={Shield}
      />

      <UserSearchInput onSelect={setSelectedUser} />

      {selectedUser && (
        <div className="space-y-4">
          <UserDetailCard user={selectedUser} />

          <GlassCard className="space-y-3">
            <p className="text-sm font-medium text-ink">Cambiar rol</p>
            {isSelf && (
              <p className="text-xs text-warning">
                No puedes modificar tu propio rol desde esta herramienta.
              </p>
            )}
            {selectedUser.role === 'super_admin' && (
              <p className="text-xs text-warning">
                No es posible modificar el rol de un Super Admin existente.
              </p>
            )}
            <RoleSelector
              value={selectedUser.role ?? 'public'}
              onChange={handleRoleChange}
              disabled={isSelf || selectedUser.role === 'super_admin'}
            />
          </GlassCard>
        </div>
      )}

      {!selectedUser && (
        <GlassCard className="py-8 text-center text-sm text-ink-muted">
          Busca un usuario para comenzar
        </GlassCard>
      )}

      {confirmOpen && selectedUser && pendingRole && (
        <RoleConfirmationDialog
          userName={selectedUser.full_name || selectedUser.email}
          currentRole={selectedUser.role}
          newRole={pendingRole}
          onConfirm={confirmRoleChange}
          onCancel={() => {
            setConfirmOpen(false)
            setPendingRole(null)
          }}
          loading={loading}
        />
      )}
    </div>
  )
}
