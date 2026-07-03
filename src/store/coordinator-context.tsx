import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CoordinatorAssignment } from '@/repositories/types'
import { supabase } from '@/lib/supabase'
import type { RegisterSiteType } from '@/repositories/types'
import { canAccessCoordinatorPanel } from '@/lib/roles'
import { useAuth } from '@/store/auth-context'

interface CoordinatorContextValue {
  assignment: CoordinatorAssignment | null
  loading: boolean
  refreshAssignment: () => Promise<void>
}

const CoordinatorContext = createContext<CoordinatorContextValue | undefined>(undefined)

async function fetchSiteName(siteType: RegisterSiteType, siteId: string): Promise<string> {
  const table =
    siteType === 'hospital' ? 'hospitals' : siteType === 'supply_center' ? 'supply_centers' : 'shelters'
  const { data, error } = await supabase.from(table).select('name').eq('id', siteId).maybeSingle()
  if (error) throw error
  return data?.name ?? 'Centro sin nombre'
}

async function loadAssignmentFromProfile(userId: string): Promise<CoordinatorAssignment | null> {
  const { data, error } = await supabase
    .from('coordinator_profiles')
    .select('site_type, site_id, onboarding_complete')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error || !data?.site_id || data.onboarding_complete === false) return null

  const siteType = data.site_type as RegisterSiteType
  const siteName = await fetchSiteName(siteType, data.site_id)
  return { siteId: data.site_id, siteType, siteName }
}

export function CoordinatorProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth()
  const [assignment, setAssignment] = useState<CoordinatorAssignment | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshAssignment = useCallback(async () => {
    if (!user || !canAccessCoordinatorPanel(role)) {
      setAssignment(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const fromProfile = await loadAssignmentFromProfile(user.id)
      setAssignment(fromProfile)
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => {
    void refreshAssignment()
  }, [refreshAssignment])

  // Re-cargar asignación cuando el rol pasa a coordinador.
  useEffect(() => {
    if (user && canAccessCoordinatorPanel(role)) {
      void refreshAssignment()
    }
  }, [user, role, refreshAssignment])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshAssignment()
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshAssignment])

  const value = useMemo(
    () => ({ assignment, loading, refreshAssignment }),
    [assignment, loading, refreshAssignment],
  )

  return <CoordinatorContext.Provider value={value}>{children}</CoordinatorContext.Provider>
}

export function useCoordinatorAssignment() {
  const ctx = useContext(CoordinatorContext)
  if (!ctx) throw new Error('useCoordinatorAssignment must be used within CoordinatorProvider')
  return ctx
}
