import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTIFICATION_QUERY_KEYS } from '@/domain/notification-models'
import { useAuth } from '@/store/auth-context'
import { pushService } from '@/push-service/push-service'
import { useNotificationPreferenceMutations } from '@/hooks/useNotificationPreferences'
import { useToast } from '@/store/toast-context'

const DISMISS_KEY = 'faro:push-modal-dismissed'

export function usePushNotifications() {
  const { user } = useAuth()
  const { update } = useNotificationPreferenceMutations()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [activating, setActivating] = useState(false)
  const available = pushService.isAvailable()

  useEffect(() => {
    if (!user?.id) return
    void pushService.login(user.id).then(async (result) => {
      if (result) {
        await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.preferences })
      }
    })
  }, [user?.id, queryClient])

  const openPermissionModal = useCallback(() => {
    if (!available || !user?.id) {
      showToast('Push no disponible: falta VITE_ONESIGNAL_APP_ID o este navegador no lo soporta.', 'warning')
      return
    }
    setModalOpen(true)
  }, [available, user?.id, showToast])

  const dismissModal = useCallback(() => {
    setModalOpen(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }, [])

  const acceptPush = useCallback(async () => {
    if (!user?.id) {
      showToast('Inicia sesión para activar alertas push.', 'warning')
      return false
    }
    setActivating(true)
    try {
      const result = await pushService.enablePush(user.id)
      if (!result) {
        showToast('No se pudo registrar este dispositivo. Usa HTTPS (Vercel) en el teléfono.', 'warning')
        return false
      }
      await update.mutateAsync({ push_enabled: true })
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.preferences })
      setModalOpen(false)
      showToast('Alertas push activadas en este dispositivo.', 'success')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al activar push'
      showToast(message, 'warning')
      return false
    } finally {
      setActivating(false)
    }
  }, [user?.id, update, queryClient, showToast])

  return {
    available,
    modalOpen,
    openPermissionModal,
    dismissModal,
    acceptPush,
    accepting: activating || update.isPending,
  }
}
