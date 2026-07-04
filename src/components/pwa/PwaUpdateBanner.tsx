import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'

/** Banner de actualización para PWA instalada/web. */
export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const onNeedRefresh = () => setVisible(true)
    window.addEventListener('faro:pwa-update-available', onNeedRefresh)
    return () => window.removeEventListener('faro:pwa-update-available', onNeedRefresh)
  }, [])

  const updateNow = async () => {
    if (!window.__faroUpdateSW) return
    setUpdating(true)
    try {
      await window.__faroUpdateSW(true)
    } finally {
      setUpdating(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-md rounded-2xl border border-info/30 bg-[#0B1327]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-2">
        <RefreshCcw className="mt-0.5 h-4 w-4 text-info" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Hay una nueva versión de FARO disponible</p>
          <p className="mt-0.5 text-xs text-ink-subtle">Actualiza para ver los últimos cambios en móvil y web.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <EmergencyButton
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => void updateNow()}
          disabled={updating}
        >
          {updating ? 'Actualizando…' : 'Actualizar ahora'}
        </EmergencyButton>
        <EmergencyButton variant="glass" size="sm" className="flex-1" onClick={() => setVisible(false)}>
          Más tarde
        </EmergencyButton>
      </div>
    </div>
  )
}
