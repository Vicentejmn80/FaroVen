import { supabase } from '@/lib/supabase'
import type { PushProvider, PushRegistrationResult } from '@/push-provider/types'

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()

type PushSubscriptionChange = {
  current?: { id?: string; optedIn?: boolean; token?: string }
}

type OneSignalInstance = {
  init: (opts: Record<string, unknown>) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    permission: boolean
    addEventListener: (event: string, handler: (event: { notification?: { additionalData?: Record<string, unknown> } }) => void) => void
  }
  User: {
    PushSubscription: {
      id?: string | null
      token?: string | null
      optedIn?: boolean
      optIn: () => Promise<void>
      addEventListener: (event: 'change', handler: (change: PushSubscriptionChange) => void) => void
      removeEventListener: (event: 'change', handler: (change: PushSubscriptionChange) => void) => void
    }
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => void | Promise<void>>
  }
}

let initPromise: Promise<void> | null = null
let clickHandler: ((actionUrl: string | null, data: Record<string, unknown>) => void) | null = null

function loadOneSignalScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (document.querySelector('script[data-faro-onesignal]')) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.dataset.faroOnesignal = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de OneSignal.'))
    document.head.appendChild(script)
  })
}

/** Encola operaciones tras init único (patrón oficial OneSignalDeferred). */
function runWithOneSignal<T>(fn: (OneSignal: OneSignalInstance) => Promise<T>): Promise<T> {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred!.push(async (OneSignal) => {
      try {
        resolve(await fn(OneSignal))
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function ensureInitialized(): Promise<void> {
  if (!APP_ID) throw new Error('Falta VITE_ONESIGNAL_APP_ID en el entorno.')
  if (initPromise) return initPromise

  initPromise = (async () => {
    await loadOneSignalScript()
    await runWithOneSignal(async (OneSignal) => {
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerUpdaterPath: '/OneSignalSDKWorker.js',
        allowLocalhostAsSecureOrigin: import.meta.env.DEV,
      })
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = (event.notification?.additionalData ?? {}) as Record<string, unknown>
        const actionUrl = typeof data.action_url === 'string' ? data.action_url : null
        clickHandler?.(actionUrl, data)
      })
    })
  })()

  return initPromise
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

async function persistSubscription(userId: string, playerId: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_subscription', {
    p_provider: 'onesignal',
    p_provider_player_id: playerId,
    p_device_type: detectDeviceType(),
  })
  if (error) {
    if (error.message?.includes('register_push_subscription') || error.code === '42883') {
      throw new Error('Falta la migración de notificaciones en Supabase (register_push_subscription).')
    }
    throw error
  }
  void userId
}

async function safeLogin(OneSignal: OneSignalInstance, userId: string): Promise<void> {
  try {
    await OneSignal.login(userId)
  } catch {
    /* login opcional — push puede funcionar sin external id */
  }
}

function subscriptionId(OneSignal: OneSignalInstance): string | null {
  return OneSignal.User.PushSubscription.id ?? OneSignal.User.PushSubscription.token ?? null
}

/** optIn() pide permiso y suscribe; esperamos el evento change con el ID. */
async function subscribeAndGetId(OneSignal: OneSignalInstance): Promise<string> {
  const existing = subscriptionId(OneSignal)
  if (OneSignal.User.PushSubscription.optedIn && existing) return existing

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      OneSignal.User.PushSubscription.removeEventListener('change', onChange)
      const late = subscriptionId(OneSignal)
      if (late && OneSignal.User.PushSubscription.optedIn) {
        resolve(late)
        return
      }
      reject(
        new Error(
          'OneSignal no completó la suscripción. En localhost puede fallar; prueba en la URL de Vercel (HTTPS).',
        ),
      )
    }, 20_000)

    const onChange = (change: PushSubscriptionChange) => {
      const id = change.current?.id ?? subscriptionId(OneSignal)
      const optedIn = change.current?.optedIn ?? OneSignal.User.PushSubscription.optedIn
      if (id && optedIn) {
        clearTimeout(timeout)
        OneSignal.User.PushSubscription.removeEventListener('change', onChange)
        resolve(id)
      }
    }

    OneSignal.User.PushSubscription.addEventListener('change', onChange)

    void OneSignal.User.PushSubscription.optIn().catch((err: unknown) => {
      clearTimeout(timeout)
      OneSignal.User.PushSubscription.removeEventListener('change', onChange)
      const message = err instanceof Error ? err.message : 'OneSignal optIn falló'
      reject(new Error(message))
    })
  })
}

export const oneSignalPushProvider: PushProvider = {
  name: 'onesignal',

  isAvailable() {
    return Boolean(APP_ID) && typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  },

  async initialize() {
    if (!this.isAvailable()) return
    await ensureInitialized()
  },

  async login(userId: string) {
    if (!this.isAvailable()) return
    await ensureInitialized()
    await runWithOneSignal(async (OneSignal) => {
      await safeLogin(OneSignal, userId)
    })
  },

  async syncExistingSubscription(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    await ensureInitialized()
    return runWithOneSignal(async (OneSignal) => {
      await safeLogin(OneSignal, userId)
      if (!OneSignal.Notifications.permission) return null
      const playerId = subscriptionId(OneSignal)
      if (!playerId || !OneSignal.User.PushSubscription.optedIn) return null
      await persistSubscription(userId, playerId)
      return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
    })
  },

  async logout() {
    if (!this.isAvailable()) return
    await ensureInitialized()
    await runWithOneSignal(async (OneSignal) => {
      await OneSignal.logout()
    })
  },

  async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    await ensureInitialized()
    return runWithOneSignal(async (OneSignal) => {
      await safeLogin(OneSignal, userId)
      const playerId = await subscribeAndGetId(OneSignal)
      await persistSubscription(userId, playerId)
      return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
    })
  },

  onNotificationClick(handler) {
    clickHandler = handler
  },
}
