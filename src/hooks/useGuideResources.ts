import { useCallback, useEffect, useMemo, useState } from 'react'
import { guideService } from '@/services/guide-service'
import { readKitChecked, writeKitChecked } from '@/lib/guide-storage'

export function useGuideResources() {
  return useMemo(
    () => ({
      modules: guideService.getModules(),
      contacts: guideService.getEmergencyContacts(),
      protocols: guideService.getProtocols(),
      kitItems: guideService.getKitItems(),
      officialResources: guideService.getOfficialResources(),
      faq: guideService.getFaq(),
      aboutBlocks: guideService.getAboutBlocks(),
      teamContact: guideService.getTeamContact(),
    }),
    [],
  )
}

const KIT_CHANGE_EVENT = 'faro:kit-checklist-change'

function emitKitChange() {
  window.dispatchEvent(new Event(KIT_CHANGE_EVENT))
}

export function useEmergencyKitChecklist() {
  const [checked, setChecked] = useState(() => readKitChecked())

  useEffect(() => {
    const sync = () => setChecked(readKitChecked())
    window.addEventListener(KIT_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(KIT_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      writeKitChecked(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    writeKitChecked({})
    setChecked({})
    emitKitChange()
  }, [])

  const completedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  )

  return { checked, toggle, reset, completedCount }
}
