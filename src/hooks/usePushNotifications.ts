import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTIFICATION_QUERY_KEYS } from '@/domain/notification-models'
import { useAuth } from '@/store/auth-context'
import { pushService } from '@/push-service/push-service'
import { useNotificationPreferenceMutations } from '@/hooks/useNotificationPreferences'
import { useToast } from '@/store/toast-context'
import { PushActivationError, pushLog } from '@/push-provider/onesignal-push-provider'

const DISMISS_KEY = 'faro:push-modal-dismissed'

export function usePushNotifications() {
  const { user } = useAuth()
  const { update } = useNotificationPreferenceMutations()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [activating, setActivating] = useState(false)
  const available = pushService.isAvailable()

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
    pushLog('clic_activar_alertas', { userId: user.id.slice(0, 8) + '…' })
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
      const message = resolvePushUserMessage(err)
      if (import.meta.env.DEV) {
        console.warn('[FARO Push]', {
          file: 'src/hooks/usePushNotifications.ts',
          line: 'L61-L73',
          step: 'activate_push_failed',
          message: 'No se pudo activar push',
          cause: err instanceof Error ? err.message : String(err),
        })
      }
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

function resolvePushUserMessage(err: unknown): string {
  if (err instanceof PushActivationError) return err.userMessage
  if (err instanceof Error) {
    const raw = err.message.toLowerCase()
    if (raw.includes('deneg') || raw.includes('permission')) {
      return 'No activaste el permiso de notificaciones. Puedes intentarlo más tarde.'
    }
    if (raw.includes('iphone') || raw.includes('pantalla de inicio')) {
      return 'En iPhone, instala FARO en la pantalla de inicio para activar push.'
    }
  }
  return 'No pudimos activar las notificaciones. Puedes seguir usando FARO normalmente e intentarlo más tarde.'
}
