import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

  try {
    const payload = (await req.json()) as WebhookPayload
    const record = payload.record
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

    const launchUrl = record.action_url
      ? `/?nav=${encodeURIComponent(record.action_url)}`
      : '/'

    const osRes = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_subscription_ids: playerIds,
        headings: { en: record.title, es: record.title },
        contents: { en: record.message, es: record.message },
        url: launchUrl,
        data: {
          action_url: record.action_url,
          notification_id: record.id,
          type: record.type,
          priority: record.priority,
        },
      }),
    })

    if (!osRes.ok) {
      const errText = await osRes.text()
      console.error('onesignal_error', errText)
      return json({ error: 'onesignal_failed' }, 502)
    }

    await supabase.from('notifications').update({ push_sent: true }).eq('id', record.id)

    return json({ ok: true, sent: playerIds.length })
  } catch (err) {
    console.error(err)
    return json({ error: 'internal' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
