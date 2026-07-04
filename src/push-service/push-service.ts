import { getPushProvider } from '@/push-provider'
import type { PushRegistrationResult } from '@/push-provider/types'
import { dispatchNotificationNavigation, parseNotificationActionUrl } from '@/lib/notification-routing'

let initPromise: Promise<void> | null = null

export const pushService = {
  isAvailable() {
    return getPushProvider().isAvailable()
  },

  async initialize() {
    if (!initPromise) {
      initPromise = getPushProvider()
        .initialize()
        .then(() => {
          getPushProvider().onNotificationClick((actionUrl) => {
            const target = parseNotificationActionUrl(actionUrl)
            if (target) dispatchNotificationNavigation(target)
          })
        })
        .catch((err) => {
          // Permite reintentar initialize() si falló una vez por red/cache.
          initPromise = null
          throw err
        })
    }
    await initPromise
  },

  async login(userId: string): Promise<PushRegistrationResult | null> {
    await this.initialize()
    const provider = getPushProvider()
    await provider.login(userId)
    return provider.syncExistingSubscription(userId)
  },

  async logout() {
    await getPushProvider().logout()
  },

  async enablePush(userId: string) {
    // No await initialize() aquí: el permiso debe pedirse antes de cualquier init.
    getPushProvider().onNotificationClick((actionUrl) => {
      const target = parseNotificationActionUrl(actionUrl)
      if (target) dispatchNotificationNavigation(target)
    })
    return getPushProvider().requestPermissionAndSubscribe(userId)
  },
}
