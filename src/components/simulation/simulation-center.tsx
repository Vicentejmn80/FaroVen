import { useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  StopCircle,
  Droplets,
  Building2,
  Flame,
  Mountain,
  Zap,
  Ambulance,
  Clock,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useSimulation } from '@/hooks/useSimulation'
import { SIMULATION_SCENARIOS, SIMULATION_SCENARIO_LABELS, type SimulationScenario } from '@/domain/operational-intelligence.types'
import { cn, timeAgo } from '@/lib/utils'

const SCENARIO_ICON_MAP: Record<SimulationScenario, any> = {
  flood: Droplets,
  earthquake: Building2,
  fire: Flame,
  landslide: Mountain,
  blackout: Zap,
  mass_accident: Ambulance,
}

export function SimulationCenter() {
  const simulation = useSimulation()
  const { state } = simulation
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>(SIMULATION_SCENARIOS.FLOOD)
  const [name, setName] = useState('')
  const [intensity, setIntensity] = useState(5)
  const [duration, setDuration] = useState(60)
  const [citizens, setCitizens] = useState(5000)
  const [centers, setCenters] = useState(8)
  const [volunteers, setVolunteers] = useState(50)
  const [resources, setResources] = useState(200)
  const [speed, setSpeed] = useState(5)
  const [autoAdvance, setAutoAdvance] = useState(true)

  const handleStart = () => {
    simulation.start(name || `Simulación ${SIMULATION_SCENARIO_LABELS[selectedScenario]}`, selectedScenario, {
      intensity,
      durationMinutes: duration,
      citizenCount: citizens,
      centerCount: centers,
      volunteerCount: volunteers,
      resourceAmount: resources,
      generationSpeed: speed,
    })
    if (autoAdvance) {
      setTimeout(() => simulation.autoRun(), 100)
    }
  }

  const canConfigure = !state || state.status === 'completed' || state.status === 'stopped'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-safe pb-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">FARO</p>
          <h1 className="truncate text-lg font-semibold text-ink">Centro de Simulación</h1>
          <p className="text-xs text-ink-subtle">Gemelo digital para entrenamiento y planificación</p>
        </div>
        {state && (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
            state.status === 'running' ? 'bg-operational/15 text-operational' : state.status === 'paused' ? 'bg-warning/15 text-warning' : 'bg-white/10 text-ink-faint',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', state.status === 'running' ? 'bg-operational animate-pulse' : state.status === 'paused' ? 'bg-warning' : 'bg-ink-faint')} />
            {state.status === 'running' ? 'En ejecución' : state.status === 'paused' ? 'En pausa' : 'Detenida'}
          </span>
        )}
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32 lg:px-8 lg:pb-8">
        <div className="space-y-4 pt-2">
          {canConfigure && (
            <GlassCard className="space-y-4">
              <h3 className="text-sm font-semibold text-ink">Configurar simulación</h3>

              <div>
                <label className="block text-xs text-ink-subtle mb-2">Escenario</label>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {(Object.keys(SIMULATION_SCENARIOS) as SimulationScenario[]).map((s) => {
                    const Icon = SCENARIO_ICON_MAP[s]
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedScenario(s)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border p-3 text-left transition-colors',
                          selectedScenario === s
                            ? 'border-info/50 bg-info/15'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                        )}
                      >
                        <Icon className="h-4 w-4 text-info shrink-0" />
                        <span className="text-xs font-medium text-ink">{SIMULATION_SCENARIO_LABELS[s]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-subtle mb-1">Nombre de la simulación</label>
                <input
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                  placeholder={`Simulación ${SIMULATION_SCENARIO_LABELS[selectedScenario]}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Intensidad (1-10)</label>
                  <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full accent-info" />
                  <span className="text-xs text-ink-faint">{intensity}/10</span>
                </div>
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Duración (min)</label>
                  <input type="number" min={10} max={1440} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink" />
                </div>
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Velocidad (1-10)</label>
                  <input type="range" min={1} max={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full accent-info" />
                  <span className="text-xs text-ink-faint">{speed}/10</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Ciudadanos</label>
                  <input type="number" min={10} max={100000} value={citizens} onChange={(e) => setCitizens(Number(e.target.value))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink" />
                </div>
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Centros</label>
                  <input type="number" min={1} max={50} value={centers} onChange={(e) => setCenters(Number(e.target.value))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink" />
                </div>
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Voluntarios</label>
                  <input type="number" min={5} max={500} value={volunteers} onChange={(e) => setVolunteers(Number(e.target.value))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink" />
                </div>
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Recursos</label>
                  <input type="number" min={10} max={1000} value={resources} onChange={(e) => setResources(Number(e.target.value))}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-ink" />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 accent-info" />
                <span className="text-xs text-ink-subtle">Avance automático (1 tick/segundo)</span>
              </label>

              <EmergencyButton variant="primary" size="sm" onClick={handleStart} className="w-full">
                <Play className="h-4 w-4" />
                Iniciar simulación
              </EmergencyButton>
            </GlassCard>
          )}

          {state && (
            <>
              <GlassCard className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">{state.name}</h3>
                  <span className="text-xs text-ink-subtle">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {state.elapsedMinutes}/{state.config.durationMinutes} min
                  </span>
                </div>

                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-info transition-all duration-300"
                    style={{ width: `${(state.elapsedMinutes / state.config.durationMinutes) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-ink">{state.metrics.reportsGenerated}</p>
                    <p className="text-[10px] text-ink-faint">Reportes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">{state.metrics.casesCreated}</p>
                    <p className="text-[10px] text-ink-faint">Casos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">{state.metrics.missionsCreated}</p>
                    <p className="text-[10px] text-ink-faint">Misiones</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">{state.metrics.volunteersActivated}</p>
                    <p className="text-[10px] text-ink-faint">Voluntarios</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold text-warning">{state.metrics.centersSaturated}</p>
                    <p className="text-[10px] text-ink-faint">Saturados</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-warning">{state.metrics.resourcesDepleted}</p>
                    <p className="text-[10px] text-ink-faint">Recursos agotados</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-critical">{state.metrics.criticalEvents}</p>
                    <p className="text-[10px] text-ink-faint">Eventos críticos</p>
                  </div>
                </div>
              </GlassCard>

              <div className="flex gap-2">
                {state.status === 'running' ? (
                  <EmergencyButton variant="glass" size="sm" onClick={simulation.pause} className="flex-1">
                    <Pause className="h-4 w-4" /> Pausar
                  </EmergencyButton>
                ) : state.status === 'paused' ? (
                  <EmergencyButton variant="primary" size="sm" onClick={simulation.resume} className="flex-1">
                    <Play className="h-4 w-4" /> Reanudar
                  </EmergencyButton>
                ) : null}
                <EmergencyButton variant="critical" size="sm" onClick={simulation.stop} className="flex-1">
                  <StopCircle className="h-4 w-4" /> Detener
                </EmergencyButton>
                <EmergencyButton variant="ghost" size="sm" onClick={simulation.reset}>
                  <RotateCcw className="h-4 w-4" />
                </EmergencyButton>
              </div>

              {state.events.length > 0 && (
                <GlassCard className="space-y-2 max-h-64 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-ink">Eventos generados ({state.events.length})</h4>
                  {[...state.events].reverse().slice(0, 20).map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 text-xs">
                      <span className={cn(
                        'h-2 w-2 rounded-full mt-0.5 shrink-0',
                        ev.severity === 'critical' ? 'bg-critical' : ev.severity === 'high' ? 'bg-warning' : 'bg-info',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-subtle truncate">{ev.description}</p>
                        <p className="text-[10px] text-ink-faint">{ev.type} · {timeAgo(ev.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </GlassCard>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
