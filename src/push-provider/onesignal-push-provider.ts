import { supabase } from '@/lib/supabase'
import type { PushProvider, PushRegistrationResult } from '@/push-provider/types'

const FILE = 'src/push-provider/onesignal-push-provider.ts'
const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()
const IS_DEV = import.meta.env.DEV

function envNumber(key: string, fallback: number, min: number, max: number): number {
  const raw = (import.meta.env as Record<string, string | undefined>)[key]
  const parsed = raw ? Number(raw) : NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

const SUBSCRIBE_TIMEOUT_MS = envNumber('VITE_PUSH_SUBSCRIBE_TIMEOUT_MS', 15_000, 5_000, 60_000)
const INIT_TIMEOUT_MS = envNumber('VITE_PUSH_INIT_TIMEOUT_MS', 10_000, 4_000, 30_000)
const RETRY_ATTEMPTS = envNumber('VITE_PUSH_RETRY_ATTEMPTS', 3, 1, 5)
const RETRY_BASE_MS = envNumber('VITE_PUSH_RETRY_BASE_MS', 300, 100, 2_000)
const CIRCUIT_FAILURE_THRESHOLD = envNumber('VITE_PUSH_CIRCUIT_FAILURE_THRESHOLD', 3, 2, 10)
const CIRCUIT_COOLDOWN_MS = envNumber('VITE_PUSH_CIRCUIT_COOLDOWN_MS', 60_000, 10_000, 300_000)

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
    addEventListener: (
      event: string,
      handler: (event: { notification?: { additionalData?: Record<string, unknown> } }) => void,
    ) => void
  }
  User: {
    PushSubscription: {
      id?: string | null
      token?: string | null
      optedIn?: boolean
      optIn: () => Promise<void>
      addEventListener: (
        event: 'change',
        handler: (change: PushSubscriptionChange) => void,
      ) => void
      removeEventListener: (
        event: 'change',
        handler: (change: PushSubscriptionChange) => void,
      ) => void
    }
  }
}

type PushActivationErrorCode =
  | 'circuit_open'
  | 'sdk_load_failed'
  | 'sdk_init_timeout'
  | 'permission_denied'
  | 'ios_install_required'
  | 'subscription_timeout'
  | 'subscription_failed'
  | 'token_persist_failed'
  | 'backend_not_ready'
  | 'unknown'

export class PushActivationError extends Error {
  readonly code: PushActivationErrorCode
  readonly userMessage: string
  readonly causeDetails?: string

  constructor(code: PushActivationErrorCode, userMessage: string, causeDetails?: string) {
    super(causeDetails ?? userMessage)
    this.name = 'PushActivationError'
    this.code = code
    this.userMessage = userMessage
    this.causeDetails = causeDetails
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => void | Promise<void>>
    __faroOneSignalInit?: Promise<OneSignalInstance>
  }
}

const initCircuit = {
  failures: 0,
  openedAt: 0,
}

let clickHandler: ((actionUrl: string | null, data: Record<string, unknown>) => void) | null = null
let clickListenerAttached = false

/** Ruta relativa a la raíz del sitio (sin / inicial). Archivo: public/push/onesignal/OneSignalSDKWorker.js */
const ONESIGNAL_SERVICE_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js'
const ONESIGNAL_SERVICE_WORKER_SCOPE = '/push/onesignal/'

function logDev(
  level: 'info' | 'warn' | 'error',
  step: string,
  line: string,
  message: string,
  cause?: unknown,
) {
  if (!IS_DEV) return
  const payload = {
    file: FILE,
    line,
    step,
    message,
    cause: cause instanceof Error ? cause.message : cause,
  }
  const prefix = '[FARO Push]'
  if (level === 'error') console.error(prefix, payload)
  else if (level === 'warn') console.warn(prefix, payload)
  else console.info(prefix, payload)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('abort') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('429')
  )
}

async function withRetry<T>(step: string, line: string, op: () => Promise<T>): Promise<T> {
  let attempt = 1
  let lastError: unknown = null
  while (attempt <= RETRY_ATTEMPTS) {
    try {
      if (attempt > 1) {
        logDev('warn', step, line, `reintento ${attempt}/${RETRY_ATTEMPTS}`)
      }
      return await op()
    } catch (err) {
      lastError = err
      if (attempt >= RETRY_ATTEMPTS || !isTransientError(err)) break
      const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1)
      await sleep(delayMs)
      attempt += 1
    }
  }
  throw lastError
}

function isCircuitOpen(): boolean {
  if (!initCircuit.openedAt) return false
  if (Date.now() - initCircuit.openedAt > CIRCUIT_COOLDOWN_MS) {
    initCircuit.openedAt = 0
    initCircuit.failures = 0
    return false
  }
  return true
}

function recordCircuitFailure() {
  initCircuit.failures += 1
  if (initCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    initCircuit.openedAt = Date.now()
    logDev(
      'warn',
      'circuit_open',
      'L160-L171',
      `circuit breaker abierto por ${CIRCUIT_COOLDOWN_MS}ms`,
    )
  }
}

function recordCircuitSuccess() {
  initCircuit.failures = 0
  initCircuit.openedAt = 0
}

function toPushActivationError(err: unknown): PushActivationError {
  if (err instanceof PushActivationError) return err
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('register_push_subscription') || message.includes('42883')) {
    return new PushActivationError(
      'backend_not_ready',
      'No pudimos activar las notificaciones todavía. Puedes seguir usando FARO e intentarlo más tarde.',
      message,
    )
  }
  if (message.toLowerCase().includes('timeout')) {
    return new PushActivationError(
      'subscription_timeout',
      'No pudimos activar las notificaciones en este momento. Puedes seguir usando FARO normalmente e intentarlo más tarde.',
      message,
    )
  }
  return new PushActivationError(
    'unknown',
    'No pudimos activar las notificaciones. Puedes seguir usando FARO normalmente e intentarlo más tarde.',
    message,
  )
}

function buildOneSignalInitOptions() {
  return {
    appId: APP_ID,
    // Custom Code: la ruta se define aquí; no hace falta configurarla en el dashboard de OneSignal.
    serviceWorkerPath: ONESIGNAL_SERVICE_WORKER_PATH,
    serviceWorkerUpdaterPath: ONESIGNAL_SERVICE_WORKER_PATH,
    serviceWorkerParam: { scope: ONESIGNAL_SERVICE_WORKER_SCOPE },
    allowLocalhostAsSecureOrigin: import.meta.env.DEV,
  }
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
        new PushActivationError(
          'sdk_load_failed',
          'No pudimos activar las notificaciones en este momento. Revisa tu conexión e inténtalo más tarde.',
          'No se pudo cargar OneSignalSDK.page.js',
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
  } catch (err) {
    logDev('warn', 'sw_ready_wait_failed', 'L274-L281', 'navigator.serviceWorker.ready falló', err)
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

function waitForOneSignalInstance(): Promise<OneSignalInstance> {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (instance) => {
      try {
        resolve(instance)
      } catch (err) {
        reject(err)
      }
    })
  })
}

function isAlreadyInitializedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /already initialized/i.test(message)
}

async function initOneSignal(instance: OneSignalInstance): Promise<void> {
  try {
    await instance.init(buildOneSignalInitOptions())
  } catch (err) {
    if (!isAlreadyInitializedError(err)) throw err
  }
}

function attachClickListener(instance: OneSignalInstance): void {
  if (clickListenerAttached) return
  clickListenerAttached = true
  instance.Notifications.addEventListener('click', (event) => {
    const data = (event.notification?.additionalData ?? {}) as Record<string, unknown>
    const actionUrl = typeof data.action_url === 'string' ? data.action_url : null
    clickHandler?.(actionUrl, data)
  })
}

async function ensureInitialized(): Promise<OneSignalInstance> {
  if (!APP_ID) throw new PushActivationError('unknown', 'Falta configurar OneSignal en el entorno.')
  if (isCircuitOpen()) {
    throw new PushActivationError(
      'circuit_open',
      'Las notificaciones están temporalmente inestables. Puedes seguir usando FARO e intentarlo en un minuto.',
    )
  }
  if (window.__faroOneSignalInit) return window.__faroOneSignalInit

  window.__faroOneSignalInit = (async () => {
    logDev('info', 'sdk_init_start', 'L342-L351', 'iniciando SDK de OneSignal')
    await withRetry('sdk_script_load', 'L343', () =>
      withTimeout(loadOneSignalScript(), INIT_TIMEOUT_MS, () =>
        new PushActivationError(
          'sdk_init_timeout',
          'No pudimos activar notificaciones ahora. Inténtalo de nuevo más tarde.',
          `Timeout cargando SDK (${INIT_TIMEOUT_MS}ms)`,
        ),
      ),
    )
    await waitForServiceWorker()
    await unregisterLegacyOneSignalWorkers()

    const instance = await withTimeout(waitForOneSignalInstance(), INIT_TIMEOUT_MS, () =>
      new PushActivationError(
        'sdk_init_timeout',
        'No pudimos activar notificaciones ahora. Inténtalo de nuevo más tarde.',
        `Timeout esperando OneSignalDeferred (${INIT_TIMEOUT_MS}ms)`,
      ),
    )
    await initOneSignal(instance)
    attachClickListener(instance)
    recordCircuitSuccess()
    logDev('info', 'sdk_initialized', 'L365-L368', 'SDK inicializado')
    return instance
  })().catch((err) => {
    if (!isAlreadyInitializedError(err)) {
      window.__faroOneSignalInit = undefined
      recordCircuitFailure()
    }
    logDev('error', 'sdk_init_failed', 'L370-L377', 'falló init de OneSignal', err)
    throw toPushActivationError(err)
  })

  return window.__faroOneSignalInit
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

async function persistSubscription(userId: string, playerId: string): Promise<void> {
  await withRetry('persist_subscription', 'L392-L409', async () => {
    const { error } = await supabase.rpc('register_push_subscription', {
      p_provider: 'onesignal',
      p_provider_player_id: playerId,
      p_device_type: detectDeviceType(),
    })
    if (error) {
      if (error.message?.includes('register_push_subscription') || error.code === '42883') {
        throw new PushActivationError(
          'backend_not_ready',
          'No pudimos activar las notificaciones todavía. Puedes seguir usando FARO e intentarlo más tarde.',
          'RPC register_push_subscription no disponible',
        )
      }
      throw error
    }
    void userId
  })
  logDev('info', 'token_saved', 'L410-L411', 'token guardado en Supabase')
}

async function safeLogin(instance: OneSignalInstance, userId: string): Promise<void> {
  try {
    await withRetry('onesignal_login', 'L415-L420', () => instance.login(userId))
    logDev('info', 'user_registered', 'L419', 'usuario registrado en OneSignal')
  } catch (err) {
    // login sigue siendo opcional; nunca romper la UI por este paso.
    logDev('warn', 'user_register_skipped', 'L421-L423', 'login opcional falló', err)
  }
}

function subscriptionId(instance: OneSignalInstance): string | null {
  return instance.User.PushSubscription.id ?? instance.User.PushSubscription.token ?? null
}

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function permissionDeniedMessage(): string {
  return 'Bloqueaste las notificaciones. Actívalas en ajustes del navegador o del sistema.'
}

function iosPushHint(): string | null {
  if (!isIosDevice()) return null
  if (isStandalonePwa()) return null
  return 'En iPhone, instala FARO en la pantalla de inicio (Compartir → Añadir a inicio) para activar push.'
}

/** Pide permiso, suscribe y espera el player ID con polling de respaldo. */
async function subscribeAndGetId(instance: OneSignalInstance): Promise<string> {
  const iosHint = iosPushHint()
  if (iosHint) {
    throw new PushActivationError('ios_install_required', iosHint)
  }

  let playerId = subscriptionId(instance)
  if (instance.User.PushSubscription.optedIn && playerId) {
    logDev('info', 'subscription_exists', 'L461-L464', 'subscription ya estaba activa')
    return playerId
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    throw new PushActivationError('permission_denied', permissionDeniedMessage())
  }

  if (!instance.Notifications.permission) {
    const granted = await instance.Notifications.requestPermission()
    if (!granted) {
      throw new PushActivationError(
        'permission_denied',
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? permissionDeniedMessage()
          : 'No activaste el permiso de notificaciones.',
      )
    }
  }

  playerId = subscriptionId(instance)
  if (instance.User.PushSubscription.optedIn && playerId) {
    logDev('info', 'subscription_created', 'L486-L489', 'subscription creada tras permiso')
    return playerId
  }

  try {
    await withRetry('onesignal_optin', 'L492-L497', () => instance.User.PushSubscription.optIn())
  } catch (err) {
    throw new PushActivationError(
      'subscription_failed',
      'No pudimos activar las notificaciones ahora. Puedes intentarlo nuevamente más tarde.',
      err instanceof Error ? err.message : String(err),
    )
  }

  const deadline = Date.now() + SUBSCRIBE_TIMEOUT_MS
  while (Date.now() < deadline) {
    playerId = subscriptionId(instance)
    if (playerId && instance.User.PushSubscription.optedIn) {
      logDev('info', 'subscription_created', 'L507-L511', 'subscription creada correctamente')
      return playerId
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      throw new PushActivationError('permission_denied', permissionDeniedMessage())
    }
    await sleep(400)
  }

  throw new PushActivationError(
    'subscription_timeout',
    'No pudimos activar las notificaciones en este momento. Puedes seguir usando FARO normalmente e intentarlo más tarde.',
    `Timeout esperando playerId (${SUBSCRIBE_TIMEOUT_MS}ms)`,
  )
}

export const oneSignalPushProvider: PushProvider = {
  name: 'onesignal',

  isAvailable() {
    return (
      Boolean(APP_ID) &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    )
  },

  async initialize() {
    if (!this.isAvailable()) return
    await ensureInitialized()
  },

  async login(userId: string) {
    if (!this.isAvailable()) return
    const instance = await ensureInitialized()
    await safeLogin(instance, userId)
  },

  async syncExistingSubscription(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    const instance = await ensureInitialized()
    await safeLogin(instance, userId)
    if (!instance.Notifications.permission) return null
    const playerId = subscriptionId(instance)
    if (!playerId || !instance.User.PushSubscription.optedIn) return null
    await persistSubscription(userId, playerId)
    return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
  },

  async logout() {
    if (!this.isAvailable()) return
    const instance = await ensureInitialized()
    await instance.logout()
  },

  async requestPermissionAndSubscribe(userId: string): Promise<PushRegistrationResult | null> {
    if (!this.isAvailable()) return null
    try {
      const instance = await ensureInitialized()
      await safeLogin(instance, userId)
      const playerId = await subscribeAndGetId(instance)
      await persistSubscription(userId, playerId)
      return { provider: 'onesignal', playerId, deviceType: detectDeviceType() }
    } catch (err) {
      const normalized = toPushActivationError(err)
      logDev('error', 'enable_push_failed', 'L586-L595', normalized.userMessage, normalized.causeDetails)
      throw normalized
    }
  },

  onNotificationClick(handler) {
    clickHandler = handler
  },
}
