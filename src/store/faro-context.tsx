import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Event, Need } from '@/domain/models'
import type { ActivityEvent, GuideCategory, Site } from '@/lib/types'
import { useFaroData } from '@/hooks/useFaroData'

interface FaroState {
  centers: ReturnType<typeof useFaroData>['centers']
  needs: Need[]
  reports: ReturnType<typeof useFaroData>['reports']
  events: Event[]
}

interface FaroContextValue {
  state: FaroState
  sites: Site[]
  summary: ReturnType<typeof useFaroData>['summary']
  latestActivity: ActivityEvent[]
  guideLibrary: GuideCategory[]
  cachedAt: Date | null
  isLoading: boolean
  loadError: string | null
}

const FaroContext = createContext<FaroContextValue | null>(null)

export function FaroProvider({ children }: { children: ReactNode }) {
  const faroData = useFaroData()

  const value = useMemo<FaroContextValue>(() => {
    return {
      state: {
        centers: faroData.centers,
        needs: faroData.needs,
        reports: faroData.reports,
        events: faroData.events,
      },
      sites: faroData.sites,
      summary: faroData.summary,
      latestActivity: faroData.latestActivity,
      guideLibrary: faroData.guideLibrary,
      cachedAt: faroData.cachedAt,
      isLoading: faroData.isLoading,
      loadError: faroData.loadError,
    }
  }, [faroData])

  return <FaroContext.Provider value={value}>{children}</FaroContext.Provider>
}

export function useFaro() {
  const context = useContext(FaroContext)
  if (!context) throw new Error('useFaro must be used inside FaroProvider')
  return context
}
