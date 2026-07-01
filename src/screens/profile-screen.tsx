import {
  Bell,
  ChevronRight,
  LogOut,
  MoonStar,
  MapPinned,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAppMode } from '@/store/app-mode-context'
import { cn } from '@/lib/utils'

interface Row {
  icon: LucideIcon
  label: string
  hint?: string
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Preferencias',
    rows: [
      { icon: MapPinned, label: 'Zona de interés', hint: 'Caracas · Distrito Capital' },
      { icon: Bell, label: 'Alertas y notificaciones' },
      { icon: Settings, label: 'Configuración' },
    ],
  },
  {
    title: 'Coordinación',
    rows: [{ icon: ShieldCheck, label: 'Modo coordinador', hint: 'Gestiona un centro' }],
  },
]

/** Vista Perfil — preferencias, alertas, modo coordinador, sesión. */
export function ProfileScreen() {
  const { mode, setMode } = useAppMode()
  const [notif, setNotif] = useState({
    critical: true,
    localArea: true,
    activitySummary: false,
  })

  return (
    <ScreenScaffold title="Perfil" subtitle="Tu cuenta">
      <div className="space-y-5 pt-2">
        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Modo de uso</p>
          <GlassCard className="grid grid-cols-2 gap-2">
            {[
              { id: 'citizen' as const, label: 'Modo ciudadano', icon: UserRound },
              { id: 'coordinator' as const, label: 'Modo coordinador', icon: ShieldCheck },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'min-h-11 rounded-2xl border px-3 py-2 text-left transition-colors',
                  mode === m.id
                    ? 'border-info/60 bg-info-soft text-ink'
                    : 'border-white/10 bg-white/[0.04] text-ink-muted hover:bg-white/[0.08]',
                )}
                onClick={() => setMode(m.id)}
              >
                <m.icon className="mb-1 h-4 w-4" />
                <p className="text-[13px] font-medium">{m.label}</p>
              </button>
            ))}
          </GlassCard>
        </section>

        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">Notificaciones</p>
          <GlassCard inset={false} className="divide-y divide-white/[0.06] overflow-hidden">
            <SwitchRow
              label="Alertas críticas"
              hint="Siempre activas en tu zona"
              checked={notif.critical}
              onToggle={() => setNotif((v) => ({ ...v, critical: !v.critical }))}
            />
            <SwitchRow
              label="Cambios en mi zona"
              hint="Capacidad, necesidades y rutas"
              checked={notif.localArea}
              onToggle={() => setNotif((v) => ({ ...v, localArea: !v.localArea }))}
            />
            <SwitchRow
              label="Resumen de actividad"
              hint="Digest cada 6 horas"
              checked={notif.activitySummary}
              onToggle={() => setNotif((v) => ({ ...v, activitySummary: !v.activitySummary }))}
            />
          </GlassCard>
        </section>

        {GROUPS.map((g) => (
          <section key={g.title} className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {g.title}
            </p>
            <GlassCard inset={false} className="divide-y divide-white/[0.06] overflow-hidden">
              {g.rows.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                    <r.icon className="h-[18px] w-[18px] text-ink-muted" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] text-ink">{r.label}</span>
                    {r.hint && <span className="block text-xs text-ink-subtle">{r.hint}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </button>
              ))}
            </GlassCard>
          </section>
        ))}

        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Tema visual</p>
            <p className="text-xs text-ink-subtle">Oscuro permanente para contraste y foco</p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
            <MoonStar className="h-4.5 w-4.5 text-ink-muted" />
          </span>
        </GlassCard>

        <EmergencyButton variant="glass" size="lg" className="w-full text-critical">
          <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
        </EmergencyButton>
      </div>
    </ScreenScaffold>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-operational/70' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  )
}
