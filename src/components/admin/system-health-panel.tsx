import { useEffect, useState } from 'react'
import { Activity, Database, Radio, RefreshCw } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { getAppReleaseCode } from '@/lib/app-meta'
import { supabase } from '@/lib/supabase'
import { useFaro } from '@/store/faro-context'
import { timeAgo } from '@/lib/utils'

interface HealthCheck {
  id: string
  label: string
  value: string
  status: 'ok' | 'warn' | 'error'
  icon: typeof Database
}

const STATUS_CLASS = {
  ok: 'text-operational',
  warn: 'text-warning',
  error: 'text-critical',
} as const

export function SystemHealthPanel() {
  const { cachedAt } = useFaro()
  const [realtimeOk, setRealtimeOk] = useState<boolean | null>(null)
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    async function probe() {
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1)
        if (mounted) setSupabaseOk(!error)
      } catch {
        if (mounted) setSupabaseOk(false)
      }

      const channel = supabase.channel('faro-health-probe')
      const timeout = window.setTimeout(() => {
        if (mounted) setRealtimeOk(false)
        void supabase.removeChannel(channel)
      }, 4000)

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout)
          if (mounted) setRealtimeOk(true)
          void supabase.removeChannel(channel)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout)
          if (mounted) setRealtimeOk(false)
          void supabase.removeChannel(channel)
        }
      })
    }

    void probe()
    return () => {
      mounted = false
    }
  }, [])

  const checks: HealthCheck[] = [
    {
      id: 'supabase',
      label: 'Supabase',
      value: supabaseOk === null ? 'Verificando…' : supabaseOk ? 'Conectado' : 'Error de conexión',
      status: supabaseOk === null ? 'warn' : supabaseOk ? 'ok' : 'error',
      icon: Database,
    },
    {
      id: 'realtime',
      label: 'Realtime',
      value: realtimeOk === null ? 'Verificando…' : realtimeOk ? 'Conectado' : 'Desconectado',
      status: realtimeOk === null ? 'warn' : realtimeOk ? 'ok' : 'error',
      icon: Radio,
    },
    {
      id: 'sync',
      label: 'Última sincronización',
      value: cachedAt ? timeAgo(cachedAt) : 'Sin datos en caché',
      status: cachedAt ? 'ok' : 'warn',
      icon: RefreshCw,
    },
    {
      id: 'version',
      label: 'Release',
      value: getAppReleaseCode(),
      status: 'ok',
      icon: Activity,
    },
  ]

  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        Salud del sistema
      </p>
      <div className="space-y-2">
        {checks.map((check) => {
          const Icon = check.icon
          return (
            <GlassCard key={check.id} className="flex items-center gap-3">
              <Icon className={`h-4 w-4 shrink-0 ${STATUS_CLASS[check.status]}`} strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{check.label}</p>
                <p className={`text-xs ${STATUS_CLASS[check.status]}`}>{check.value}</p>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </section>
  )
}
