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

const STORAGE_KEY = 'faro.coordinator.assignment'

interface CoordinatorContextValue {
  assignment: CoordinatorAssignment | null
  loading: boolean
  bindAssignment: (input: CoordinatorAssignment) => void
  clearAssignment: () => void
}

const CoordinatorContext = createContext<CoordinatorContextValue | undefined>(undefined)

async function fetchSiteName(siteType: RegisterSiteType, siteId: string): Promise<string> {
  const table =
    siteType === 'hospital' ? 'hospitals' : siteType === 'supply_center' ? 'supply_centers' : 'shelters'
  const { data, error } = await supabase.from(table).select('name').eq('id', siteId).maybeSingle()
  if (error) throw error
  return data?.name ?? 'Centro sin nombre'
}

async function loadAssignmentFromProfile(): Promise<CoordinatorAssignment | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return null

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

function readStoredAssignment(): CoordinatorAssignment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CoordinatorAssignment
    if (!parsed?.siteId || !parsed?.siteType) return null
    return parsed
  } catch {
    return null
  }
}

export function CoordinatorProvider({ children }: { children: ReactNode }) {
  const [assignment, setAssignment] = useState<CoordinatorAssignment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const fromProfile = await loadAssignmentFromProfile()
        if (!mounted) return
        if (fromProfile) {
          setAssignment(fromProfile)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fromProfile))
        } else {
          setAssignment(readStoredAssignment())
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadAssignmentFromProfile().then((next) => {
        if (next) {
          setAssignment(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
      })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const bindAssignment = useCallback((input: CoordinatorAssignment) => {
    setAssignment(input)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  }, [])

  const clearAssignment = useCallback(() => {
    setAssignment(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo(
    () => ({ assignment, loading, bindAssignment, clearAssignment }),
    [assignment, loading, bindAssignment, clearAssignment],
  )

  return <CoordinatorContext.Provider value={value}>{children}</CoordinatorContext.Provider>
}

export function useCoordinatorAssignment() {
  const ctx = useContext(CoordinatorContext)
  if (!ctx) throw new Error('useCoordinatorAssignment must be used within CoordinatorProvider')
  return ctx
}
