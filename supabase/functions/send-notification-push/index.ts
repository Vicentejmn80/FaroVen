import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const FILE = 'supabase/functions/send-notification-push/index.ts'
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PUSH_WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? ''
const DEBUG_PUSH =
  (Deno.env.get('FARO_PUSH_DEBUG') ?? '').toLowerCase() === 'true' ||
  (Deno.env.get('DENO_ENV') ?? '').toLowerCase() === 'development'
const ONESIGNAL_TIMEOUT_MS = readNumberEnv('ONESIGNAL_TIMEOUT_MS', 8000, 3000, 20000)
const RETRY_ATTEMPTS = readNumberEnv('ONESIGNAL_RETRY_ATTEMPTS', 3, 1, 5)
const RETRY_BASE_MS = readNumberEnv('ONESIGNAL_RETRY_BASE_MS', 300, 100, 2000)
const CIRCUIT_FAILURE_THRESHOLD = readNumberEnv('ONESIGNAL_CIRCUIT_THRESHOLD', 3, 2, 10)
const CIRCUIT_COOLDOWN_MS = readNumberEnv('ONESIGNAL_CIRCUIT_COOLDOWN_MS', 60000, 10000, 300000)

const providerCircuit = {
  failures: 0,
  openedAt: 0,
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    user_id: string
    title: string
    message: string
    type: string
    priority: string
    action_url: string | null
    push_sent: boolean
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  const requestId = crypto.randomUUID()
  try {
    const providedSecret = req.headers.get('x-faro-webhook-secret') ?? ''
    if (!PUSH_WEBHOOK_SECRET) {
      log('error', {
        requestId,
        step: 'missing_webhook_secret',
        line: 'L45-L52',
        message: 'PUSH_WEBHOOK_SECRET no configurado',
      })
      return json({ ok: false, reason: 'server_not_configured' }, 500)
    }
    if (providedSecret !== PUSH_WEBHOOK_SECRET) {
      log('warn', {
        requestId,
        step: 'unauthorized_webhook',
        line: 'L53-L61',
        message: 'Webhook sin secreto válido',
      })
      return json({ ok: false, reason: 'unauthorized' }, 401)
    }

    log('info', {
      requestId,
      step: 'edge_function_executed',
      line: 'L63-L66',
      message: 'Edge Function ejecutada',
    })

    const payload = (await req.json()) as WebhookPayload
    const record = payload.record
    log('info', {
      requestId,
      step: 'webhook_received',
      line: 'L48-L52',
      message: 'Webhook recibido',
      notificationId: record?.id,
      userId: record?.user_id,
    })

    if (!record?.user_id || record.push_sent) {
      return json({ skipped: true })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, muted_until')
      .eq('user_id', record.user_id)
      .maybeSingle()

    if (!prefs?.push_enabled) return json({ skipped: true, reason: 'push_disabled' })
    if (prefs.muted_until && new Date(prefs.muted_until) > new Date()) {
      return json({ skipped: true, reason: 'muted' })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('provider_player_id')
      .eq('user_id', record.user_id)
      .eq('provider', 'onesignal')

    const playerIds = (subs ?? []).map((s) => s.provider_player_id).filter(Boolean)
    if (!playerIds.length || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ skipped: true, reason: 'no_subscriptions' })
    }

    if (isCircuitOpen()) {
      log('warn', {
        requestId,
        step: 'circuit_open',
        line: 'L78-L85',
        message: 'Circuit breaker abierto para OneSignal',
        failures: providerCircuit.failures,
      })
      return json({ skipped: true, reason: 'provider_temporarily_unavailable' })
    }

    const launchUrl = record.action_url
      ? `/?nav=${encodeURIComponent(record.action_url)}`
      : '/'

    const oneSignalResult = await sendToOneSignalWithRetry({
      requestId,
      record,
      playerIds,
      launchUrl,
    })
    recordCircuitSuccess()
    log('info', {
      requestId,
      step: 'onesignal_responded',
      line: 'L93-L100',
      message: 'OneSignal respondió',
      status: oneSignalResult.status,
      responseId: oneSignalResult.responseId,
      recipients: playerIds.length,
    })

    await supabase.from('notifications').update({ push_sent: true }).eq('id', record.id)
    log('info', {
      requestId,
      step: 'push_sent',
      line: 'L109-L114',
      message: 'Push enviada y marcada en DB',
      notificationId: record.id,
    })

    return json({ ok: true, sent: playerIds.length })
  } catch (err) {
    recordCircuitFailure()
    const message = err instanceof Error ? err.message : String(err)
    log('error', {
      requestId,
      step: 'push_dispatch_failed',
      line: 'L118-L126',
      message: 'Falló despacho push',
      cause: message,
      failures: providerCircuit.failures,
    })
    // Fallback: nunca romper el flujo principal de notificaciones de FARO.
    return json({ ok: false, skipped: true, reason: 'push_dispatch_failed' })
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type OneSignalSendInput = {
  requestId: string
  record: WebhookPayload['record']
  playerIds: string[]
  launchUrl: string
}

type OneSignalSendResult = {
  status: number
  responseId: string | null
}

type OneSignalApiResponse = {
  id?: string
  errors?: unknown
}

async function sendToOneSignalWithRetry(input: OneSignalSendInput): Promise<OneSignalSendResult> {
  let attempt = 1
  let lastErr: unknown = null

  while (attempt <= RETRY_ATTEMPTS) {
    try {
      if (attempt > 1) {
        log('warn', {
          requestId: input.requestId,
          step: 'onesignal_retry',
          line: 'L160-L167',
          message: `Reintento OneSignal ${attempt}/${RETRY_ATTEMPTS}`,
        })
      }
      return await sendToOneSignalOnce(input)
    } catch (err) {
      lastErr = err
      if (attempt >= RETRY_ATTEMPTS || !isTransientOneSignalError(err)) break
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
      attempt += 1
    }
  }

  throw lastErr
}

async function sendToOneSignalOnce(input: OneSignalSendInput): Promise<OneSignalSendResult> {
  const body = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_subscription_ids: input.playerIds,
    headings: { en: input.record.title, es: input.record.title },
    contents: { en: input.record.message, es: input.record.message },
    url: input.launchUrl,
    data: {
      action_url: input.record.action_url,
      notification_id: input.record.id,
      type: input.record.type,
      priority: input.record.priority,
    },
  })

  const response = await fetchWithTimeout(
    'https://api.onesignal.com/notifications',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body,
    },
    ONESIGNAL_TIMEOUT_MS,
  )

  const responseText = await response.text()
  let parsed: OneSignalApiResponse = {}
  try {
    parsed = responseText ? (JSON.parse(responseText) as OneSignalApiResponse) : {}
  } catch {
    parsed = {}
  }

  if (!response.ok) {
    const shortErr = responseText.slice(0, 500)
    throw new Error(`onesignal_http_${response.status}:${shortErr}`)
  }

  return { status: response.status, responseId: parsed.id ?? null }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('onesignal_timeout'), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function isTransientOneSignalError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('429') ||
    msg.includes('onesignal_http_5')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readNumberEnv(key: string, fallback: number, min: number, max: number): number {
  const raw = Deno.env.get(key)
  const parsed = raw ? Number(raw) : NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function isCircuitOpen(): boolean {
  if (!providerCircuit.openedAt) return false
  if (Date.now() - providerCircuit.openedAt > CIRCUIT_COOLDOWN_MS) {
    providerCircuit.openedAt = 0
    providerCircuit.failures = 0
    return false
  }
  return true
}

function recordCircuitFailure() {
  providerCircuit.failures += 1
  if (providerCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    providerCircuit.openedAt = Date.now()
  }
}

function recordCircuitSuccess() {
  providerCircuit.failures = 0
  providerCircuit.openedAt = 0
}

function log(
  level: 'info' | 'warn' | 'error',
  payload: Record<string, unknown>,
) {
  if (!DEBUG_PUSH) return
  const data = { file: FILE, ...payload }
  if (level === 'error') console.error('[FARO Push Edge]', data)
  else if (level === 'warn') console.warn('[FARO Push Edge]', data)
  else console.info('[FARO Push Edge]', data)
}
