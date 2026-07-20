import { Clock3, Handshake, HeartHandshake, MapPinned } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { ActionCard } from '@/components/ui/action-card'
import { EmptyState } from '@/components/ui/empty-state'
import { GlassCard } from '@/components/ui/glass-card'
import { loadVolunteerImpact } from '@/lib/volunteer-impact'
import { useAuth } from '@/store/auth-context'

interface VolunteerCollaborationsScreenProps {
  onBrowseNeeds: () => void
  onOpenMap: () => void
}

/** Pantalla «Colaboraciones» — seguimiento de participación del voluntario. */
export function VolunteerCollaborationsScreen({
  onBrowseNeeds,
  onOpenMap,
}: VolunteerCollaborationsScreenProps) {
  const { user } = useAuth()
  const impact = loadVolunteerImpact(user?.id)
  const hasHistory =
    impact.hoursCollaborated > 0 ||
    impact.needsSupported > 0 ||
    impact.peopleHelped > 0 ||
    impact.centersVisited > 0

  return (
    <ScreenScaffold title="Mis colaboraciones" subtitle="Red de Apoyo · tu participación">
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-2.5">
          <GlassCard className="space-y-1 p-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">Horas este mes</p>
            <p className="text-2xl font-semibold tabular-nums text-ink">{impact.hoursCollaborated}</p>
          </GlassCard>
          <GlassCard className="space-y-1 p-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">Necesidades apoyadas</p>
            <p className="text-2xl font-semibold tabular-nums text-ink">{impact.needsSupported}</p>
          </GlassCard>
        </div>

        {hasHistory ? (
          <GlassCard className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              En progreso
            </p>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-info" />
                  Horas registradas
                </span>
                <span className="font-semibold tabular-nums text-ink">{impact.hoursCollaborated} h</span>
              </li>
              <li className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-info" />
                  Personas ayudadas
                </span>
                <span className="font-semibold tabular-nums text-ink">{impact.peopleHelped}</span>
              </li>
              <li className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-info" />
                  Centros visitados
                </span>
                <span className="font-semibold tabular-nums text-ink">{impact.centersVisited}</span>
              </li>
            </ul>
          </GlassCard>
        ) : (
          <EmptyState
            icon={Handshake}
            title="Aún no tienes colaboraciones"
            description="Explora necesidades activas cerca de ti y ofrece tu ayuda para empezar a registrar impacto."
          />
        )}

        <GlassCard inset={false} className="space-y-1 p-2">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Acciones
          </p>
          <ActionCard
            variant="row"
            icon={HeartHandshake}
            label="Ver necesidades activas"
            hint="Lista operativa del voluntario"
            onClick={onBrowseNeeds}
          />
          <ActionCard
            variant="row"
            icon={MapPinned}
            label="Abrir mapa"
            hint="Centros y contexto territorial"
            onClick={onOpenMap}
          />
        </GlassCard>
      </div>
    </ScreenScaffold>
  )
}
