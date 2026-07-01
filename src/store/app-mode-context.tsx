import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppMode = 'citizen' | 'coordinator'

interface AppModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

const STORAGE_KEY = 'faro.app.mode'

const AppModeContext = createContext<AppModeContextValue | null>(null)

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'citizen'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'coordinator' ? 'coordinator' : 'citizen'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      setMode: setModeState,
    }),
    [mode],
  )

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
}

export function useAppMode() {
  const context = useContext(AppModeContext)
  if (!context) throw new Error('useAppMode must be used inside AppModeProvider')
  return context
}
