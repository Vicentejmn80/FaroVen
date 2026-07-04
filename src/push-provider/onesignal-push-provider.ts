import { supabase } from '@/lib/supabase'
import type { PushProvider, PushRegistrationResult } from '@/push-provider/types'

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()
const SUBSCRIBE_TIMEOUT_MS = 30_000

type PushSubscriptionChange = {
  current?: { id?: string; optedIn?: boolean; token?: string }
}

type OneSignalInstance = {
  init: (opts: Record<string, unknown>) => Promise<void>
  login: (externalId: string) => Promise<void>
  logout: () => Promise<void>
  Notifications: {
    permission: boolean
    requestPermission: () => Promise<boolean>
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

let initPromise: Promise<OneSignalInstance> | null = null
let clickHandler: ((actionUrl: string | null, data: Record<string, unknown>) => void) | null = null

/** OneSignal en subdirectorio para no chocar con el SW de la PWA (scope /). */
const ONESIGNAL_SW_PATH = 'push/onesignal/OneSignalSDKWorker.js'
const ONESIGNAL_SW_SCOPE = '/push/onesignal/'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadOneSignalScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (document.querySelector('script[src*="OneSignalSDK.page.js"]')) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(
        new Error(
          'No se pudo cargar el SDK de OneSignal. Revisa bloqueadores de anuncios o la política CSP del sitio.',
        ),
      )
    document.head.appendChild(script)
  })
}

/** Espera al SW de la PWA antes de inicializar OneSignal en producción. */
async function waitForServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.ready
  } catch {
    /* continuar — OneSignal intentará registrar el worker */
  }
}

/** Elimina el worker viejo en la raíz (/OneSignalSDKWorker.js). No toca sw.js de la PWA. */
async function unregisterLegacyOneSignalWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrl =
        registration.active?.scriptURL ??
        registration.waiting?.scriptURL ??
        registration.installing?.scriptURL ??
        ''
      if (scriptUrl.includes('/OneSignalSDKWorker.js') && !scriptUrl.includes('/push/onesignal/')) {
        await registration.unregister()
      }
    }),
  )
}

async function ensureInitialized(): Promise<OneSignalInstance> {
  if (!APP_ID) throw new Error('Falta VITE_ONESIGNAL_APP_ID en el entorno.')
  if (initPromise) return initPromise

  initPromise = (async () => {
    await loadOneSignalScript()
    await waitForServiceWorker()
    await unregisterLegacyOneSignalWorkers()

    const OneSignal = await new Promise<OneSignalInstance>((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred!.push(async (instance) => {
        try {
          resolve(instance)
        } catch (err) {
          reject(err)
        }
      })
    })

    await OneSignal.init({
      appId: APP_ID,
      serviceWorkerPath: ONESIGNAL_SW_PATH,
      serviceWorkerUpdaterPath: ONESIGNAL_SW_PATH,
      serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
    })

    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = (event.notification?.additionalData ?? {}) as Record<string, unknown>
      const actionUrl = typeof data.action_url === 'string' ? data.action_url : null
      clickHandler?.(actionUrl, data)
    })

    return OneSignal
  })().catch((err) => {
    initPromise = null
    throw err
  })

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

function permissionDeniedMessage(): string {
  return 'Bloqueaste las notificaciones. Actívalas en ajustes del navegador o del sistema.'
}

/** Pide permiso, suscribe y espera el player ID con polling de respaldo. */
async function subscribeAndGetId(OneSignal: OneSignalInstance): Promise<string> {
  let id = subscriptionId(OneSignal)
  if (OneSignal.User.PushSubscription.optedIn && id) return id

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    throw new Error(permissionDeniedMessage())
  }

  if (!OneSignal.Notifications.permission) {
    const granted = await OneSignal.Notifications.requestPermission()
    if (!granted) {
      throw new Error(
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? permissionDeniedMessage()
          : 'Permiso de notificaciones denegado.',
      )
    }
  }

  id = subscriptionId(OneSignal)
  if (OneSignal.User.PushSubscription.optedIn && id) return id

  try {
    await OneSignal.User.PushSubscription.optIn()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OneSignal optIn falló'
    throw new Error(message)
  }

  const deadline = Date.now() + SUBSCRIBE_TIMEOUT_MS
  while (Date.now() < deadline) {
    id = subscriptionId(OneSignal)
    if (id && OneSignal.User.PushSubscription.optedIn) return id
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      throw new Error(permissionDeniedMessage())
    }
    await sleep(500)
  }

  throw new Error(
    'No se pudo completar la suscripción push. Pulsa "Actualizar ahora" si ves el banner de nueva versión y vuelve a intentar.',
  )
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
    const OneSignal = await ensureInitialized()
    await safeLogin(OneSignal, userId)
  },

  async syncExistingSubscription(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    const OneSignal = await ensureInitialized()
    await safeLogin(OneSignal, userId)
    if (!OneSignal.Notifications.permission) return null
    const playerId = subscriptionId(OneSignal)
    if (!playerId || !OneSignal.User.PushSubscription.optedIn) return null
    await persistSubscription(userId, playerId)
    return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
  },

  async logout() {
    if (!this.isAvailable()) return
    const OneSignal = await ensureInitialized()
    await OneSignal.logout()
  },

  async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    const OneSignal = await ensureInitialized()
    await safeLogin(OneSignal, userId)
    const playerId = await subscribeAndGetId(OneSignal)
    await persistSubscription(userId, playerId)
    return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
  },

  onNotificationClick(handler) {
    clickHandler = handler
  },
}
