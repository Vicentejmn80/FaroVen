import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-provider'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useIsAdmin } from '@/hooks/useAdmin'
import { CoordinatorOnboardingView } from './coordinator/CoordinatorOnboardingView'
import { TriageDashboard } from './coordinator/TriageDashboard'
import type { CoordinatorSiteType } from '@/lib/types'

const SITE_EMOJI: Record<CoordinatorSiteType, string> = {
  hospital: '🏥',
  supply_center: '📦',
  shelter: '🏠',
}

export type CoordTab = 'hub' | 'sitio' | 'necesidades' | 'saturacion' | 'personas' | 'reportes'

interface CoordinatorPanelProps {
  notify: (msg: string) => void
  onBack: () => void
  onOpenAdmin: () => void
  onNeedAuth: () => void
  initialTab?: CoordTab
}

export function CoordinatorPanel({
  notify,
  onBack,
  onOpenAdmin,
  onNeedAuth,
}: CoordinatorPanelProps) {
  const { user, signOut } = useAuth()
  const { data: profile, isLoading } = useCoordinatorProfile()
  const { data: isAdmin } = useIsAdmin()
  const [editingProfile, setEditingProfile] = useState(false)

  const isReady = !!profile && profile.onboarding_complete !== false

  useEffect(() => {
    if (!user) onNeedAuth()
  }, [user, onNeedAuth])

  if (!user) return null

  if (isLoading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#9aa3b2' }}>Cargando…</p>
      </div>
    )
  }

  const displayName = profile?.full_name ?? user.email?.split('@')[0]
  const siteLabel = profile?.site_name
    ? `${SITE_EMOJI[profile.site_type]} ${profile.site_name}`
    : null

  if (!isReady || editingProfile) {
    return (
      <div>
        <div className="pv3-view-header">
          <div>
            <h2 className="pv3-view-title">
              {editingProfile ? 'Actualizar registro' : 'Registro de coordinador'}
            </h2>
            <p style={{ fontSize: 12, color: '#9aa3b2', margin: '4px 0 0' }}>
              {displayName}
              {siteLabel ? ` · ${siteLabel}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editingProfile && (
              <button type="button" className="pv3-btn" onClick={() => setEditingProfile(false)}>
                Cancelar
              </button>
            )}
            <button type="button" className="pv3-btn" onClick={onBack}>
              Volver
            </button>
          </div>
        </div>

        <div className="pv3-card">
          <CoordinatorOnboardingView
            notify={notify}
            onDone={() => {
              setEditingProfile(false)
              notify('Registro actualizado.')
            }}
          />
        </div>

        <div className="triage-footer" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="triage-footer__link"
            onClick={() => signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="pv3-view-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="pv3-view-title">Panel de coordinador</h2>
          <p style={{ fontSize: 12, color: '#9aa3b2', margin: '4px 0 0' }}>
            {displayName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="triage-footer__link"
            style={{ fontSize: 13 }}
            onClick={() => signOut()}
          >
            Salir
          </button>
          <button type="button" className="pv3-btn" onClick={onBack}>
            Inicio
          </button>
        </div>
      </div>

      <TriageDashboard
        notify={notify}
        onEditProfile={() => setEditingProfile(true)}
        onOpenAdmin={onOpenAdmin}
        isAdmin={!!isAdmin}
      />
    </div>
  )
}
