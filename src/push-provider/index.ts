import { oneSignalPushProvider } from '@/push-provider/onesignal-push-provider'
import { noopPushProvider } from '@/push-provider/noop-push-provider'
import type { PushProvider } from '@/push-provider/types'

export function getPushProvider(): PushProvider {
  if (oneSignalPushProvider.isAvailable()) return oneSignalPushProvider
  return noopPushProvider
}

export type { PushProvider, PushRegistrationResult } from '@/push-provider/types'
