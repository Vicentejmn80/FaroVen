import type { PushProvider } from '@/push-provider/types'

export const noopPushProvider: PushProvider = {
  name: 'noop',
  isAvailable: () => false,
  async initialize() {},
  async requestPermissionAndSubscribe() {
    return null
  },
  async login() {},
  async syncExistingSubscription() {
    return null
  },
  async logout() {},
  onNotificationClick() {},
}
