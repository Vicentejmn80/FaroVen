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

  /** Sincroniza token existente sin forzar init al abrir la app. */
  async syncExistingSubscription(userId: string): Promise<PushRegistrationResult | null> {
    this.attachNotificationClickHandler()
    return getPushProvider().syncExistingSubscription(userId)
  },

  attachNotificationClickHandler() {
    getPushProvider().onNotificationClick((actionUrl) => {
      const target = parseNotificationActionUrl(actionUrl)
      if (target) dispatchNotificationNavigation(target)
    })
  },

  async logout() {
    await getPushProvider().logout()
  },

  async enablePush(userId: string) {
    this.attachNotificationClickHandler()
    return getPushProvider().requestPermissionAndSubscribe(userId)
  },
}
